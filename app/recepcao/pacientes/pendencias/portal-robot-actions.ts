// app/recepcao/pacientes/pendencias/portal-robot-actions.ts
"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { sanitizeFileName } from "@/lib/file-name";
import { sniffAllowed } from "@/lib/upload-bytes";
import { DOCUMENTS_BUCKET, robotAdmin, type PortalRobotJobRow } from "@/lib/portal-robot";
import {
  canCancel,
  isAgentOnline,
  normalizeRequest,
  OPEN_STATUSES,
  suggestedReferenceMonth,
  type PortalRobotPayload,
  type PortalRobotProfessional,
  type PortalRobotRequestInput,
} from "@/lib/portal-robot-pure";

/**
 * Etapa 2 pelo robô: em vez de sair do sistema para preencher o portal do plano,
 * a recepção pede o envio aqui, um agente instalado no computador da clínica
 * preenche o portal e para no resumo, e a recepção confirma na própria tela.
 * Tudo com o client de sessão (RLS de portal_robot_jobs: recepção/supervisor/
 * gestor da clínica); o service role só assina o link do print. Ver
 * docs/portal-robot.md.
 */

type Fail = { success: false; error: string };

export type PortalRobotJobView = {
  id: string;
  mode: "simular" | "autorizar";
  status: PortalRobotJobRow["status"];
  step: number;
  stepLabel: string | null;
  payload: PortalRobotPayload;
  portalSummary: Record<string, unknown> | null;
  result: PortalRobotJobRow["result"];
  error: string | null;
  requestedAt: string;
  finishedAt: string | null;
  screenshotUrl: string | null;
};

export type PortalRobotState = { job: PortalRobotJobView | null; agentOnline: boolean };

export type PortalRobotFormDefaults = {
  patientName: string | null;
  cardNumber: string;
  cid: string;
  referenceMonth: string;
  files: { id: string; name: string; detectedType: string | null }[];
  suggestedFileId: string | null;
  professionals: (PortalRobotProfessional & { id: string })[];
  /** Último pedido deste contato (para repetir depois de um erro sem redigitar). */
  previous: PortalRobotPayload | null;
};

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Tabelas novas ainda fora dos tipos gerados (mesmo cast de lib/reception-queue.ts).
  return { db: supabase as unknown as SupabaseClient, user };
}

function refresh() {
  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
}

async function toView(job: PortalRobotJobRow | null): Promise<PortalRobotJobView | null> {
  if (!job) return null;
  let screenshotUrl: string | null = null;
  if (job.screenshot_path) {
    const { data } = await robotAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUrl(job.screenshot_path, 600);
    screenshotUrl = data?.signedUrl ?? null;
  }
  return {
    id: job.id,
    mode: job.mode,
    status: job.status,
    step: job.step,
    stepLabel: job.step_label,
    payload: job.payload,
    portalSummary: job.portal_summary,
    result: job.result,
    error: job.error,
    requestedAt: job.requested_at,
    finishedAt: job.finished_at,
    screenshotUrl,
  };
}

/** Estado do robô para o cartão da etapa 2 — a tela consulta a cada poucos segundos enquanto há pedido em curso. */
export async function getPortalRobotState(draftId: string): Promise<{ success: true; state: PortalRobotState } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const [{ data: job }, { data: agents }] = await Promise.all([
    db.from("portal_robot_jobs").select("*").eq("draft_id", draftId).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("portal_robot_agents").select("last_seen_at").eq("active", true),
  ]);
  const now = new Date();
  return {
    success: true,
    state: {
      job: await toView((job as PortalRobotJobRow | null) ?? null),
      agentOnline: (agents ?? []).some((a: { last_seen_at: string | null }) => isAgentOnline(a.last_seen_at, now)),
    },
  };
}

/** Pré-preenche o formulário "Enviar pelo robô" com o que o sistema já sabe do contato. */
export async function getPortalRobotFormDefaults(draftId: string): Promise<{ success: true; defaults: PortalRobotFormDefaults } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await db
    .from("registration_drafts")
    .select("id, patient_id, extracted")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };

  const extracted = (draft.extracted ?? {}) as {
    patient?: { full_name?: string | null; cid?: string | null };
    insurance?: { card_number?: string | null };
  };

  let patientName = extracted.patient?.full_name ?? null;
  let cardNumber = extracted.insurance?.card_number ?? "";
  if (draft.patient_id) {
    const [{ data: patient }, { data: plans }] = await Promise.all([
      db.from("patients").select("full_name").eq("id", draft.patient_id).maybeSingle(),
      db.from("patient_insurance").select("card_number").eq("patient_id", draft.patient_id).eq("is_private", false),
    ]);
    patientName = (patient as { full_name?: string } | null)?.full_name ?? patientName;
    const card = (plans ?? []).map((p: { card_number: string | null }) => p.card_number).find(Boolean);
    if (card) cardNumber = card;
  }

  const [{ data: files }, { data: professionals }, { data: previous }] = await Promise.all([
    db.from("registration_draft_files").select("id, original_name, detected_type, mime_type").eq("draft_id", draftId).order("created_at"),
    db.from("portal_robot_professionals").select("id, name, council, register, uf, cbo").eq("active", true).order("name"),
    db.from("portal_robot_jobs").select("payload").eq("draft_id", draftId).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // O portal aceita PDF ou imagem; o laudo/pedido médico é o anexo que o plano exige.
  const attachable = (files ?? []).filter((f: { mime_type: string }) => /pdf|jpe?g|png/i.test(f.mime_type));
  const preferred =
    attachable.find((f: { detected_type: string | null }) => f.detected_type === "pedido_medico") ??
    attachable.find((f: { detected_type: string | null }) => f.detected_type === "laudo") ??
    null;

  return {
    success: true,
    defaults: {
      patientName,
      cardNumber: String(cardNumber ?? "").replace(/\D/g, ""),
      cid: (extracted.patient?.cid ?? "").toUpperCase(),
      referenceMonth: suggestedReferenceMonth(new Date(), CLINIC_TIMEZONE),
      files: attachable.map((f: { id: string; original_name: string | null; detected_type: string | null }) => ({
        id: f.id,
        name: f.original_name ?? "arquivo",
        detectedType: f.detected_type,
      })),
      suggestedFileId: (preferred as { id: string } | null)?.id ?? null,
      professionals: (professionals ?? []) as PortalRobotFormDefaults["professionals"],
      previous: ((previous as { payload: PortalRobotPayload } | null)?.payload ?? null),
    },
  };
}

// O portal Conecta aceita PDF ou imagem JPG/PNG no anexo.
const LAUDO_MIMES: ReadonlySet<string> = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_LAUDO_BYTES = 20 * 1024 * 1024;

/**
 * Laudo enviado do computador da recepção, para quando o arquivo certo não
 * chegou pelo WhatsApp. Vira um arquivo do próprio contato
 * (registration_draft_files, mesmo bucket e pasta dos que chegam pelo
 * WhatsApp), já marcado como laudo, e pode ser escolhido no formulário.
 */
export async function uploadPortalRobotLaudo(
  draftId: string,
  formData: FormData,
): Promise<{ success: true; file: { id: string; name: string; detectedType: string } } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Escolha um arquivo." };
  if (file.size > MAX_LAUDO_BYTES) return { success: false, error: "Arquivo grande demais (máximo 20 MB)." };

  // RLS: só enxerga o contato quem pode trabalhar nele.
  const { data: draft } = await db.from("registration_drafts").select("id").eq("id", draftId).maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };

  // Tipo real pelos bytes, não pelo nome/`file.type` que vêm do navegador.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffAllowed(bytes, LAUDO_MIMES);
  if (!sniffed) return { success: false, error: "O portal só aceita PDF, JPG ou PNG." };

  const name = sanitizeFileName(file.name, { ext: sniffed.ext, fallback: "laudo" });
  const storagePath = `drafts/${draftId}/laudo-recepcao-${Date.now()}.${sniffed.ext}`;
  const admin = robotAdmin();
  const { error: uploadError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: sniffed.mime, upsert: false });
  if (uploadError) return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };

  const { data: row, error: insertError } = await admin
    .from("registration_draft_files")
    .insert({
      draft_id: draftId,
      storage_path: storagePath,
      mime_type: sniffed.mime,
      size_bytes: bytes.byteLength,
      original_name: name,
      detected_type: "laudo",
      content_sha256: createHash("sha256").update(bytes).digest("hex"),
    })
    .select("id")
    .single();
  if (insertError || !row) {
    await admin.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { success: false, error: "Não foi possível salvar o arquivo. Tente de novo." };
  }

  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true, file:{ id: (row as { id: string }).id, name, detectedType: "laudo" } };
}

/** Coloca o pedido na fila do robô. Um pedido em aberto por contato (índice único no banco). */
export async function requestPortalRobot(draftId: string, input: PortalRobotRequestInput): Promise<{ success: true } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const parsed = normalizeRequest(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const req = parsed.value;

  const { data: draft } = await db
    .from("registration_drafts")
    .select("id, clinic_id, patient_id, extracted, guide_sent_at, plan_authorized_at, authorization_waived")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };
  // Prevenção de duplicidade (AGENTS.md §3): guia já enviada/autorizada não gera outro envio.
  if (draft.guide_sent_at || draft.plan_authorized_at || draft.authorization_waived) {
    return { success: false, error: "A guia deste contato já foi enviada ou autorizada. Desfaça a etapa antes de enviar de novo." };
  }

  const { data: file } = await db
    .from("registration_draft_files")
    .select("id, storage_path, original_name, mime_type")
    .eq("id", req.laudoFileId)
    .eq("draft_id", draftId)
    .maybeSingle();
  if (!file) return { success: false, error: "O arquivo do laudo não pertence a este contato." };

  let patientName = ((draft.extracted ?? {}) as { patient?: { full_name?: string | null } }).patient?.full_name ?? null;
  if (draft.patient_id) {
    const { data: patient } = await db.from("patients").select("full_name").eq("id", draft.patient_id).maybeSingle();
    patientName = (patient as { full_name?: string } | null)?.full_name ?? patientName;
  }

  const payload: PortalRobotPayload = {
    patient_name: patientName,
    card_number: req.card_number,
    cid: req.cid,
    reference_month: req.reference_month,
    observation: req.observation,
    professional: req.professional,
    procedures: req.procedures,
    laudo: { file_id: file.id, storage_path: file.storage_path, name: file.original_name ?? "laudo", mime_type: file.mime_type },
  };

  const { error } = await db.from("portal_robot_jobs").insert({
    clinic_id: draft.clinic_id,
    draft_id: draftId,
    mode: req.mode,
    payload,
    requested_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { success: false, error: "Já existe um pedido em andamento no robô para este contato." };
    return { success: false, error: "Não foi possível colocar o pedido na fila do robô. Tente de novo." };
  }

  // Médico solicitante fica guardado para os próximos pedidos (sem bloquear o envio se falhar).
  await db
    .from("portal_robot_professionals")
    .upsert({ clinic_id: draft.clinic_id, ...req.professional, active: true }, { onConflict: "clinic_id,council,register" });

  refresh();
  return { success: true };
}

/** A recepção conferiu o resumo (no portal e na tela) e libera o clique em Autorizar. */
export async function confirmPortalRobot(jobId: string): Promise<{ success: true } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data, error } = await db
    .from("portal_robot_jobs")
    .update({ status: "confirmado", confirmed_by: user.id, confirmed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "aguardando_confirmacao")
    .eq("mode", "autorizar")
    .select("id");
  if (error || !data || data.length === 0) {
    return { success: false, error: "Este pedido não está mais esperando confirmação. Atualize a tela." };
  }
  refresh();
  return { success: true };
}

/** Cancela antes da confirmação (depois dela o robô pode já estar clicando em Autorizar). */
export async function cancelPortalRobot(jobId: string): Promise<{ success: true } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: job } = await db.from("portal_robot_jobs").select("id, status").eq("id", jobId).maybeSingle();
  if (!job) return { success: false, error: "Pedido não encontrado." };
  if (!canCancel(job.status)) return { success: false, error: "Depois da confirmação não dá para cancelar — o robô já está enviando." };

  const { data, error } = await db
    .from("portal_robot_jobs")
    .update({ status: "cancelado", finished_at: new Date().toISOString(), error: "Cancelado pela recepção." })
    .eq("id", jobId)
    .in("status", OPEN_STATUSES.filter((s) => s !== "confirmado"))
    .select("id");
  if (error || !data || data.length === 0) return { success: false, error: "Não foi possível cancelar. Atualize a tela." };
  refresh();
  return { success: true };
}
