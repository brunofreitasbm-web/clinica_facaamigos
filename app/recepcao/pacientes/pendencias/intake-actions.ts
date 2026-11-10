// app/recepcao/pacientes/pendencias/intake-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { INTAKE_MIGRATION_PENDING_MESSAGE, isMissingIntakeColumnError } from "@/lib/intake-columns-pure";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import {
  disableDraftScheduling,
  enableDraftScheduling,
  markGuideSent,
  registerAuthorizedGuide,
  waiveDraftAuthorization,
  type AuthorizedGuideInput,
} from "./draft-pipeline-actions";
import {
  DRAFT_STATE_COLUMNS,
  buildUndoToken,
  decideRestore,
  shouldRestorePatient,
  validateUndoToken,
  type DraftStateRow,
  type UndoKind,
  type UndoToken,
} from "@/lib/intake-undo-pure";

/**
 * Resposta do plano na etapa 3 da Fila de entrada, além da autorização
 * (colunas de registration_drafts criadas em 20261110120000):
 *   - "Plano negou": grava plan_denied_at/by e limpa guide_sent_at, então o caso
 *     volta para a etapa 2 e para o grupo "Agir agora" (enviar a guia de novo);
 *   - "Plano pediu mais documentos": grava plan_more_docs_at/by e também limpa
 *     guide_sent_at, então o caso volta para a etapa 1 (cobrar a família) e a
 *     guia precisa ser reenviada com os documentos novos.
 * Reenviar a guia grava um guide_sent_at mais novo que a marca, e a marca deixa
 * de valer (activePlanOutcome em lib/fila/fila-model-pure.ts).
 *
 * Cada ação devolve o estado anterior para o aviso de "Desfazer" (8 s). O
 * desfazer só vale se a marca ainda é a que esta ação gravou: se outra pessoa
 * mexeu no caso depois, nada é revertido.
 *
 * Mesmas regras de draft-pipeline-actions.ts: client de sessão, e a RLS de
 * registration_drafts já restringe o update a recepção/supervisor/gestor da clínica.
 */

type ActionResult = { success: true; note?: string } | { success: false; error: string };

/** Estado de antes da ação, guardado no aviso de "Desfazer" do caso. */
export type PlanOutcomeUndo = {
  /** Valor que a ação gravou em plan_denied_at / plan_more_docs_at. */
  appliedAt: string;
  previous: {
    guideSentAt: string | null;
    guideSentBy: string | null;
    /** Marca anterior do mesmo tipo (uma segunda negativa sobrescreve a primeira). */
    markAt: string | null;
    markBy: string | null;
  };
};

export type PlanOutcomeResult = { success: true; undo: PlanOutcomeUndo } | { success: false; error: string };

type Kind = "denied" | "more_docs";

const COLUMNS: Record<Kind, { at: "plan_denied_at" | "plan_more_docs_at"; by: "plan_denied_by" | "plan_more_docs_by" }> = {
  denied: { at: "plan_denied_at", by: "plan_denied_by" },
  more_docs: { at: "plan_more_docs_at", by: "plan_more_docs_by" },
};

type DraftUpdate = Database["public"]["Tables"]["registration_drafts"]["Update"];

/** Campos da marca (negativa ou pedido de documentos) no formato do update. */
function markFields(kind: Kind, at: string | null, by: string | null): DraftUpdate {
  return kind === "denied" ? { plan_denied_at: at, plan_denied_by: by } : { plan_more_docs_at: at, plan_more_docs_by: by };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isIsoOrNull = (v: unknown): v is string | null => v === null || (typeof v === "string" && !Number.isNaN(Date.parse(v)));
const isUuidOrNull = (v: unknown): v is string | null => v === null || (typeof v === "string" && UUID.test(v));

function validUndo(undo: PlanOutcomeUndo | null | undefined): undo is PlanOutcomeUndo {
  if (!undo || typeof undo !== "object" || !undo.previous || typeof undo.appliedAt !== "string") return false;
  const p = undo.previous;
  return (
    !Number.isNaN(Date.parse(undo.appliedAt)) &&
    isIsoOrNull(p.guideSentAt) &&
    isUuidOrNull(p.guideSentBy) &&
    isIsoOrNull(p.markAt) &&
    isUuidOrNull(p.markBy)
  );
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh() {
  revalidatePath("/recepcao");
  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/supervisao");
}

async function markPlanOutcome(draftId: string, kind: Kind): Promise<PlanOutcomeResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const col = COLUMNS[kind];
  const { data: draft, error: draftError } = await supabase
    .from("registration_drafts")
    .select(
      "id, guide_sent_at, guide_sent_by, plan_authorized_at, authorization_waived, scheduling_enabled_at, plan_denied_at, plan_denied_by, plan_more_docs_at, plan_more_docs_by",
    )
    .eq("id", draftId)
    .maybeSingle();
  if (draftError && isMissingIntakeColumnError(draftError)) return { success: false, error: INTAKE_MIGRATION_PENDING_MESSAGE };
  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (draft.scheduling_enabled_at) {
    return { success: false, error: "O caso já está habilitado para agendamento. Retire a habilitação antes." };
  }
  if (draft.plan_authorized_at || draft.authorization_waived) {
    return { success: false, error: "A autorização já foi registrada. Desfaça a autorização antes de registrar outra resposta do plano." };
  }
  if (!draft.guide_sent_at) {
    return { success: false, error: "A guia ainda não consta como enviada ao plano." };
  }

  const appliedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("registration_drafts")
    .update({ ...markFields(kind, appliedAt, user.id), guide_sent_at: null, guide_sent_by: null })
    .eq("id", draftId)
    // Mesmas condições conferidas acima, de novo no update: se o caso mudou entre a leitura e a gravação, nada é gravado.
    .eq("guide_sent_at", draft.guide_sent_at)
    .is("scheduling_enabled_at", null)
    .is("plan_authorized_at", null)
    .eq("authorization_waived", false)
    .select("id");
  if (error) return { success: false, error: "Não foi possível registrar a resposta do plano. Tente de novo." };
  if (!updated || updated.length === 0) {
    return { success: false, error: "O caso mudou enquanto você registrava. Confira e tente de novo." };
  }

  refresh();
  return {
    success: true,
    undo: {
      appliedAt,
      previous: {
        guideSentAt: draft.guide_sent_at,
        guideSentBy: draft.guide_sent_by,
        markAt: draft[col.at],
        markBy: draft[col.by],
      },
    },
  };
}

async function undoPlanOutcome(draftId: string, kind: Kind, undo: PlanOutcomeUndo): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };
  if (!validUndo(undo)) return { success: false, error: "Não foi possível desfazer. Recarregue a página." };

  const col = COLUMNS[kind];
  // Só reverte se a marca ainda é a que esta ação gravou e a guia não foi reenviada depois.
  const { data: updated, error } = await supabase
    .from("registration_drafts")
    .update({
      ...markFields(kind, undo.previous.markAt, undo.previous.markBy),
      guide_sent_at: undo.previous.guideSentAt,
      guide_sent_by: undo.previous.guideSentBy,
    })
    .eq("id", draftId)
    .eq(col.at, undo.appliedAt)
    .is("guide_sent_at", null)
    .select("id");
  if (error) return { success: false, error: "Não foi possível desfazer. Tente de novo." };
  if (!updated || updated.length === 0) {
    return { success: false, error: "O caso mudou depois disso. Nada foi desfeito." };
  }

  refresh();
  return { success: true };
}

/** "Plano negou": o caso volta para a etapa 2 (enviar a guia de novo) e para "Agir agora". */
export async function denyPlan(draftId: string): Promise<PlanOutcomeResult> {
  return markPlanOutcome(draftId, "denied");
}

/** Desfaz "Plano negou" com o estado guardado no aviso. */
export async function undoDenyPlan(draftId: string, previous: PlanOutcomeUndo): Promise<ActionResult> {
  return undoPlanOutcome(draftId, "denied", previous);
}

/** "Plano pediu mais documentos": o caso volta para a etapa 1 (cobrar a família e reenviar a guia). */
export async function planAskedMoreDocs(draftId: string): Promise<PlanOutcomeResult> {
  return markPlanOutcome(draftId, "more_docs");
}

/** Desfaz "Plano pediu mais documentos" com o estado guardado no aviso. */
export async function undoPlanAskedMoreDocs(draftId: string, previous: PlanOutcomeUndo): Promise<ActionResult> {
  return undoPlanOutcome(draftId, "more_docs", previous);
}

// ---------------------------------------------------------------------------
// Ações da Fila de entrada com "Desfazer" que restaura o estado exato.
//
// Cada uma lê o estado do caso antes, chama a ação de sempre de draft-pipeline-actions.ts (que o
// Chat e Pendências continuam usando sem mudança), lê o estado depois e devolve um UndoToken
// (lib/intake-undo-pure.ts). restoreIntakeState devolve as colunas guardadas com um update direto,
// só se o caso ainda estiver como a ação deixou. O desfazer nunca chama enableDraftScheduling, então
// não manda de novo a oferta de horários pelo WhatsApp.
// ---------------------------------------------------------------------------

type Supa = Awaited<ReturnType<typeof createClient>>;

export type UndoableResult =
  | { success: true; note?: string; offer?: "sent" | "duplicate" | "failed"; undo: UndoToken | null }
  | { success: false; error: string };

type Snapshot = { row: DraftStateRow; patientId: string | null; patientStatus: string | null };

const MISSING_COLUMNS = "missing_columns" as const;

async function readState(supabase: Supa, draftId: string): Promise<Snapshot | typeof MISSING_COLUMNS | null> {
  const { data, error } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("registration_drafts")
    .select(`${DRAFT_STATE_COLUMNS.join(", ")}, patient_id, patients(status)`)
    .eq("id", draftId)
    .maybeSingle();
  if (error && isMissingIntakeColumnError(error)) return MISSING_COLUMNS;
  if (!data) return null;
  const rec = data as unknown as Record<string, unknown>;
  const patients = rec.patients as { status: string | null } | { status: string | null }[] | null;
  const patient = Array.isArray(patients) ? patients[0] : patients;
  return {
    row: rec as unknown as DraftStateRow,
    patientId: (rec.patient_id as string | null) ?? null,
    patientStatus: patient?.status ?? null,
  };
}

async function readStateOrNull(supabase: Supa, draftId: string): Promise<Snapshot | null> {
  const state = await readState(supabase, draftId);
  return state === MISSING_COLUMNS ? null : state;
}

/** Lê antes, roda a ação, lê depois e monta o desfazer. */
async function withUndo<R extends { success: true; note?: string; offer?: "sent" | "duplicate" | "failed" } | { success: false; error: string }>(
  draftId: string,
  kind: UndoKind,
  action: () => Promise<R>,
): Promise<UndoableResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };
  const before = await readState(supabase, draftId);
  if (before === MISSING_COLUMNS) return { success: false, error: INTAKE_MIGRATION_PENDING_MESSAGE };
  if (!before) return { success: false, error: "Contato não encontrado." };
  const result = await action();
  if (!result.success) return result;
  const after = await readStateOrNull(supabase, draftId);
  const patientId = before.patientId ?? after?.patientId ?? null;
  const undo = after
    ? buildUndoToken(kind, before.row, after.row, patientId ? { id: patientId, before: before.patientStatus, after: after.patientStatus } : null)
    : null;
  return { success: true, note: result.note, offer: result.offer, undo };
}

export async function intakeMarkGuideSent(draftId: string): Promise<UndoableResult> {
  return withUndo(draftId, "guide_sent", () => markGuideSent(draftId));
}

export async function intakeEnableScheduling(draftId: string): Promise<UndoableResult> {
  return withUndo(draftId, "scheduling", () => enableDraftScheduling(draftId));
}

export async function intakeDisableScheduling(draftId: string): Promise<UndoableResult> {
  return withUndo(draftId, "scheduling", () => disableDraftScheduling(draftId));
}

export async function intakeWaiveAuthorization(draftId: string): Promise<UndoableResult> {
  return withUndo(draftId, "waive", () => waiveDraftAuthorization(draftId));
}

/**
 * A guia autorizada vai direto para o prontuário? (paciente vinculado com um único plano, a mesma
 * regra de registerAuthorizedGuide). Nesse caso a tela pede confirmação antes e não oferece desfazer.
 */
export async function authorizedGuideGoesToRecord(draftId: string): Promise<{ success: true; goesToRecord: boolean } | { success: false; error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };
  const { data: draft } = await supabase.from("registration_drafts").select("patient_id").eq("id", draftId).maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (!draft.patient_id) return { success: true, goesToRecord: false };
  const { data: plans } = await supabase
    .from("patient_insurance")
    .select("id")
    .eq("patient_id", draft.patient_id)
    .eq("is_private", false);
  return { success: true, goesToRecord: Boolean(plans && plans.length === 1) };
}

export type AuthorizedUploadResult =
  | {
      success: true;
      /** Avisos do registro da guia e da habilitação juntos. */
      note?: string;
      offer?: "sent" | "duplicate" | "failed";
      /** A guia foi salva, mas a habilitação falhou. */
      enableError?: string;
      /** null quando a guia foi gravada no prontuário: não há desfazer que volte tudo. */
      undo: UndoToken | null;
    }
  | { success: false; error: string };

/** "Subir guia autorizada (PDF)": grava a guia, habilita o agendamento e devolve o desfazer. */
export async function intakeRegisterAuthorizedGuide(draftId: string, input: AuthorizedGuideInput): Promise<AuthorizedUploadResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };
  const before = await readState(supabase, draftId);
  if (before === MISSING_COLUMNS) return { success: false, error: INTAKE_MIGRATION_PENDING_MESSAGE };
  if (!before) return { success: false, error: "Contato não encontrado." };

  const saved = await registerAuthorizedGuide(draftId, input);
  if (!saved.success) return saved;
  const enabled = await enableDraftScheduling(draftId);

  const after = await readStateOrNull(supabase, draftId);
  const patientId = before.patientId ?? after?.patientId ?? null;
  const undo = after
    ? buildUndoToken("authorization", before.row, after.row, patientId ? { id: patientId, before: before.patientStatus, after: after.patientStatus } : null)
    : null;
  return {
    success: true,
    note: [saved.note, enabled.success ? enabled.note : undefined].filter(Boolean).join(" ") || undefined,
    offer: enabled.success ? enabled.offer : undefined,
    enableError: enabled.success ? undefined : enabled.error,
    undo,
  };
}

/**
 * Desfaz uma ação da Fila de entrada com o estado guardado no aviso. Um update só, com as colunas
 * conferidas no próprio filtro (compare-and-set): se o caso mudou depois da ação, nada é desfeito.
 * O status do paciente volta só se ainda é o que a promoção automática gravou.
 */
export async function restoreIntakeState(draftId: string, rawToken: UndoToken): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };
  const token = validateUndoToken(rawToken);
  if (!token) return { success: false, error: "Não foi possível desfazer. Recarregue a página." };

  const current = await readState(supabase, draftId);
  if (current === MISSING_COLUMNS) return { success: false, error: INTAKE_MIGRATION_PENDING_MESSAGE };
  if (!current) return { success: false, error: "Contato não encontrado." };
  const decision = decideRestore(token, current.row);
  if (!decision.ok) return { success: false, error: "O caso mudou depois disso. Nada foi desfeito." };

  let query = supabase
    .from("registration_drafts")
    .update(decision.update as DraftUpdate)
    .eq("id", draftId);
  // Filtro com os valores lidos agora (mesmo formato do banco), já conferidos por decideRestore.
  for (const col of Object.keys(token.applied) as (keyof DraftStateRow)[]) {
    const value = current.row[col];
    if (value === null || value === undefined) query = query.is(col, null);
    else if (typeof value === "boolean" || typeof value === "string") query = query.eq(col, value);
  }
  const { data: updated, error } = await query.select("id");
  if (error) return { success: false, error: "Não foi possível desfazer. Tente de novo." };
  if (!updated || updated.length === 0) return { success: false, error: "O caso mudou depois disso. Nada foi desfeito." };

  if (token.patient && current.patientId === token.patient.id && shouldRestorePatient(token, current.patientStatus)) {
    await supabase.from("patients").update({ status: token.patient.previous }).eq("id", token.patient.id).eq("status", token.patient.applied);
  }

  refresh();
  return { success: true };
}
