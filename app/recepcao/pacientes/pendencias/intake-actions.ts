// app/recepcao/pacientes/pendencias/intake-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

/**
 * Resposta do plano na etapa 3 da Fila de entrada, além da autorização
 * (colunas de registration_drafts criadas em 20261110120000):
 *   - "Plano negou": grava plan_denied_at/by e limpa guide_sent_at, então o caso
 *     volta para a etapa 2 e para o grupo "Agir agora" (enviar a guia de novo);
 *   - "Plano pediu mais documentos": grava plan_more_docs_at/by e também limpa
 *     guide_sent_at, então o caso volta para a etapa 1 (cobrar a família) e a
 *     guia precisa ser reenviada com os documentos novos.
 * Reenviar a guia grava um guide_sent_at mais novo que a marca, e a marca deixa
 * de valer (activePlanOutcome em lib/intake-queue-build-pure.ts).
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
  const { data: draft } = await supabase
    .from("registration_drafts")
    .select(
      "id, guide_sent_at, guide_sent_by, plan_authorized_at, authorization_waived, scheduling_enabled_at, plan_denied_at, plan_denied_by, plan_more_docs_at, plan_more_docs_by",
    )
    .eq("id", draftId)
    .maybeSingle();
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
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { success: false, error: "Não foi possível registrar a resposta do plano. Tente de novo." };
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
