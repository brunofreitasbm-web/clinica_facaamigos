// app/recepcao/pacientes/pendencias/portal-robot-actions.ts
"use server";

import { createHash, randomUUID } from "node:crypto";
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
  laudoMimeFromPath,
  normalizeRequest,
  OPEN_STATUSES,
  suggestedReferenceMonth,
  type PortalRobotPayload,
  type PortalRobotProfessional,
  type PortalRobotRequestInput,
  type PortalRobotTarget,
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
  /** Último pedido deste contato/guia ou, se não houver, do paciente (mês seguinte vem pronto). */
  previous: PortalRobotPayload | null;
  /** Terapias da guia em renovação, quando o paciente nunca passou pelo robô. */
  fallbackProcedures: PortalRobotPayload["procedures"];
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
  revalidatePath("/recepcao/pacientes");
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

// ---------------------------------------------------------------- alvo do pedido
//
// O pedido do robô nasce de um contato novo (etapa 2 de Autorizações) ou de uma
// guia em renovação (linha "pendente" em `authorizations`, criada pelo "Pedir
// renovação"). Este bloco traduz os dois para o que o formulário precisa.

type LaudoFile = { id: string; name: string; detectedType: string | null; storagePath: string; mimeType: string };

type TargetContext = {
  clinicId: string;
  patientId: string | null;
  patientName: string | null;
  cardNumber: string;
  cid: string;
  /** Por que não dá para pedir agora (guia já enviada, renovação já respondida…). */
  blocked: string | null;
  /** Terapias sugeridas quando o paciente nunca passou pelo robô. */
  fallbackProcedures: PortalRobotPayload["procedures"];
};

const TARGET_LABEL = { draft: "contato", authorization: "guia" } as const;

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

async function loadTarget(db: SupabaseClient, target: PortalRobotTarget): Promise<TargetContext | null> {
  if (target.kind === "draft") {
    const { data: draft } = await db
      .from("registration_drafts")
      .select("id, clinic_id, patient_id, extracted, guide_sent_at, plan_authorized_at, authorization_waived")
      .eq("id", target.id)
      .maybeSingle();
    if (!draft) return null;
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
    return {
      clinicId: draft.clinic_id,
      patientId: draft.patient_id ?? null,
      patientName,
      cardNumber: digits(cardNumber),
      cid: (extracted.patient?.cid ?? "").toUpperCase(),
      // Prevenção de duplicidade (AGENTS.md §3): guia já enviada/autorizada não gera outro envio.
      blocked:
        draft.guide_sent_at || draft.plan_authorized_at || draft.authorization_waived
          ? "A guia deste contato já foi enviada ou autorizada. Desfaça a etapa antes de enviar de novo."
          : null,
      fallbackProcedures: [],
    };
  }

  const { data: auth } = await db
    .from("authorizations")
    .select("id, status, procedure_code, sessions_authorized, patient_insurance_id, previous_authorization_id")
    .eq("id", target.id)
    .maybeSingle();
  if (!auth) return null;
  const { data: plan } = await db
    .from("patient_insurance")
    .select("card_number, patient_id")
    .eq("id", auth.patient_insurance_id)
    .maybeSingle();
  if (!plan) return null;
  const { data: patient } = await db
    .from("patients")
    .select("id, full_name, cid, clinic_id")
    .eq("id", plan.patient_id)
    .maybeSingle();
  if (!patient) return null;

  let blocked: string | null = null;
  if (auth.status !== "pendente" || !auth.previous_authorization_id) {
    blocked = "O robô envia só renovações pedidas e ainda sem resposta do plano.";
  } else {
    // Mesma regra dos contatos: depois de enviada ao plano, não manda de novo.
    const { data: sent } = await db
      .from("portal_robot_jobs")
      .select("id")
      .eq("authorization_id", target.id)
      .in("status", ["enviado", "verificar"])
      .limit(1);
    if (sent && sent.length > 0) blocked = "Esta renovação já foi enviada ao plano pelo robô.";
  }

  const code = digits(auth.procedure_code);
  return {
    clinicId: patient.clinic_id,
    patientId: patient.id,
    patientName: patient.full_name ?? null,
    cardNumber: digits(plan.card_number),
    cid: String(patient.cid ?? "").toUpperCase(),
    blocked,
    fallbackProcedures: code ? [{ code, description: "", quantity: Number(auth.sessions_authorized) || 1 }] : [],
  };
}

/** Arquivos que podem ir como laudo: os do contato (WhatsApp) ou os documentos do paciente. */
async function listLaudoFiles(db: SupabaseClient, target: PortalRobotTarget, ctx: TargetContext): Promise<LaudoFile[]> {
  if (target.kind === "draft") {
    const { data } = await db
      .from("registration_draft_files")
      .select("id, original_name, detected_type, mime_type, storage_path")
      .eq("draft_id", target.id)
      .order("created_at");
    return (data ?? [])
      .filter((f: { mime_type: string }) => /pdf|jpe?g|png/i.test(f.mime_type))
      .map((f: { id: string; original_name: string | null; detected_type: string | null; mime_type: string; storage_path: string }) => ({
        id: f.id,
        name: f.original_name ?? "arquivo",
        detectedType: f.detected_type,
        storagePath: f.storage_path,
        mimeType: f.mime_type,
      }));
  }
  if (!ctx.patientId) return [];
  const { data } = await db
    .from("documents")
    .select("id, category, storage_path, uploaded_at")
    .eq("patient_id", ctx.patientId)
    .order("uploaded_at", { ascending: false });
  const files: LaudoFile[] = [];
  for (const d of (data ?? []) as { id: string; category: string; storage_path: string; uploaded_at: string }[]) {
    const mimeType = laudoMimeFromPath(d.storage_path);
    if (!mimeType) continue;
    const day = d.uploaded_at.slice(0, 10).split("-").reverse().join("/");
    files.push({
      id: d.id,
      name: `${d.storage_path.split("/").pop() ?? "arquivo"} · ${day}`,
      detectedType: d.category,
      storagePath: d.storage_path,
      mimeType,
    });
  }
  return files;
}

async function lastPayload(db: SupabaseClient, target: PortalRobotTarget, patientId: string | null): Promise<PortalRobotPayload | null> {
  const column = target.kind === "draft" ? "draft_id" : "authorization_id";
  const { data: own } = await db
    .from("portal_robot_jobs")
    .select("payload")
    .eq(column, target.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (own) return (own as { payload: PortalRobotPayload }).payload;
  if (!patientId) return null;
  // Mês seguinte: o último pedido do paciente (médico, CID, terapias) vem pronto.
  const { data: last } = await db
    .from("portal_robot_jobs")
    .select("payload")
    .eq("patient_id", patientId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last as { payload: PortalRobotPayload } | null)?.payload ?? null;
}

/** Estado do robô no cartão — a tela consulta a cada poucos segundos enquanto há pedido em curso. */
export async function getPortalRobotState(target: PortalRobotTarget): Promise<{ success: true; state: PortalRobotState } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const column = target.kind === "draft" ? "draft_id" : "authorization_id";
  const [{ data: job }, { data: agents }] = await Promise.all([
    db.from("portal_robot_jobs").select("*").eq(column, target.id).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
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

/** Pré-preenche o formulário "Enviar pelo robô" com o que o sistema já sabe. */
export async function getPortalRobotFormDefaults(target: PortalRobotTarget): Promise<{ success: true; defaults: PortalRobotFormDefaults } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const ctx = await loadTarget(db, target);
  if (!ctx) return { success: false, error: target.kind === "draft" ? "Contato não encontrado." : "Guia não encontrada." };

  const [files, { data: professionals }, previous] = await Promise.all([
    listLaudoFiles(db, target, ctx),
    db.from("portal_robot_professionals").select("id, name, council, register, uf, cbo").eq("active", true).order("name"),
    lastPayload(db, target, ctx.patientId),
  ]);

  // O laudo/pedido médico é o anexo que o plano exige; o mais recente primeiro.
  const preferred = files.find((f) => f.detectedType === "pedido_medico") ?? files.find((f) => f.detectedType === "laudo") ?? null;

  return {
    success: true,
    defaults: {
      patientName: ctx.patientName,
      cardNumber: ctx.cardNumber,
      cid: ctx.cid,
      referenceMonth: suggestedReferenceMonth(new Date(), CLINIC_TIMEZONE),
      files: files.map((f) => ({ id: f.id, name: f.name, detectedType: f.detectedType })),
      suggestedFileId: preferred?.id ?? null,
      professionals: (professionals ?? []) as PortalRobotFormDefaults["professionals"],
      previous,
      fallbackProcedures: ctx.fallbackProcedures,
    },
  };
}

// O portal Conecta aceita PDF ou imagem JPG/PNG no anexo.
const LAUDO_MIMES: ReadonlySet<string> = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_LAUDO_BYTES = 20 * 1024 * 1024;

/**
 * Laudo enviado do computador da recepção, para quando o arquivo certo não
 * está no sistema. Contato novo: vira um arquivo do contato
 * (registration_draft_files, mesma pasta dos que chegam pelo WhatsApp).
 * Renovação: vira um documento do paciente (documents, categoria "laudo"),
 * que fica na ficha e serve para os meses seguintes.
 */
export async function uploadPortalRobotLaudo(
  target: PortalRobotTarget,
  formData: FormData,
): Promise<{ success: true; file: { id: string; name: string; detectedType: string } } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Escolha um arquivo." };
  if (file.size > MAX_LAUDO_BYTES) return { success: false, error: "Arquivo grande demais (máximo 20 MB)." };

  // RLS: só enxerga o contato/guia quem pode trabalhar nele.
  const ctx = await loadTarget(db, target);
  if (!ctx) return { success: false, error: target.kind === "draft" ? "Contato não encontrado." : "Guia não encontrada." };

  // Tipo real pelos bytes, não pelo nome/`file.type` que vêm do navegador.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffAllowed(bytes, LAUDO_MIMES);
  if (!sniffed) return { success: false, error: "O portal só aceita PDF, JPG ou PNG." };
  const name = sanitizeFileName(file.name, { ext: sniffed.ext, fallback: "laudo" });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const admin = robotAdmin();

  if (target.kind === "authorization") {
    if (!ctx.patientId) return { success: false, error: "Paciente não encontrado." };
    // Mesmo fluxo do upload de documentos da ficha (documents-actions.ts): insert
    // com o client de sessão (a RLS de documents é o portão), depois o arquivo.
    const documentId = randomUUID();
    const storagePath = `${ctx.patientId}/${documentId}/${name}`;
    const { error: insertError } = await db.from("documents").insert({
      id: documentId,
      patient_id: ctx.patientId,
      category: "laudo",
      storage_path: storagePath,
      uploaded_by: user.id,
      content_sha256: sha256,
    });
    if (insertError) return { success: false, error: "Você não tem permissão para anexar documentos a este paciente." };
    const { error: uploadError } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, bytes, { contentType: sniffed.mime, upsert: false });
    if (uploadError) {
      await admin.from("documents").delete().eq("id", documentId);
      return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };
    }
    revalidatePath(`/recepcao/pacientes/${ctx.patientId}`);
    const day = new Date().toISOString().slice(0, 10).split("-").reverse().join("/");
    return { success: true, file: { id: documentId, name: `${name} · ${day}`, detectedType: "laudo" } };
  }

  const storagePath = `drafts/${target.id}/laudo-recepcao-${Date.now()}.${sniffed.ext}`;
  const { error: uploadError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: sniffed.mime, upsert: false });
  if (uploadError) return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };

  const { data: row, error: insertError } = await admin
    .from("registration_draft_files")
    .insert({
      draft_id: target.id,
      storage_path: storagePath,
      mime_type: sniffed.mime,
      size_bytes: bytes.byteLength,
      original_name: name,
      detected_type: "laudo",
      content_sha256: sha256,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    await admin.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { success: false, error: "Não foi possível salvar o arquivo. Tente de novo." };
  }

  refresh();
  return { success: true, file: { id: (row as { id: string }).id, name, detectedType: "laudo" } };
}

/** Coloca o pedido na fila do robô. Um pedido em aberto por contato/guia (índice único no banco). */
export async function requestPortalRobot(target: PortalRobotTarget, input: PortalRobotRequestInput): Promise<{ success: true } | Fail> {
  const { db, user } = await session();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const parsed = normalizeRequest(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const req = parsed.value;

  const ctx = await loadTarget(db, target);
  if (!ctx) return { success: false, error: target.kind === "draft" ? "Contato não encontrado." : "Guia não encontrada." };
  if (ctx.blocked) return { success: false, error: ctx.blocked };

  const file = (await listLaudoFiles(db, target, ctx)).find((f) => f.id === req.laudoFileId);
  if (!file) return { success: false, error: `O arquivo do laudo não pertence a este ${TARGET_LABEL[target.kind]}.` };

  const payload: PortalRobotPayload = {
    patient_name: ctx.patientName,
    card_number: req.card_number,
    cid: req.cid,
    reference_month: req.reference_month,
    observation: req.observation,
    professional: req.professional,
    procedures: req.procedures,
    laudo: { file_id: file.id, storage_path: file.storagePath, name: file.name, mime_type: file.mimeType },
  };

  const { error } = await db.from("portal_robot_jobs").insert({
    clinic_id: ctx.clinicId,
    draft_id: target.kind === "draft" ? target.id : null,
    authorization_id: target.kind === "authorization" ? target.id : null,
    patient_id: ctx.patientId,
    mode: req.mode,
    payload,
    requested_by: user.id,
  });
  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `Já existe um pedido em andamento no robô para este ${TARGET_LABEL[target.kind]}.` };
    }
    return { success: false, error: "Não foi possível colocar o pedido na fila do robô. Tente de novo." };
  }

  // Médico solicitante fica guardado para os próximos pedidos (sem bloquear o envio se falhar).
  await db
    .from("portal_robot_professionals")
    .upsert({ clinic_id: ctx.clinicId, ...req.professional, active: true }, { onConflict: "clinic_id,council,register" });

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
