// app/supervisao/acolhimento-actions.ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { normalizeCpf, parseBrDate, normalizePhone } from "@/lib/document-extraction";
import { claimAndProcessIntakeBatches, ingestPreExtractedIntakeBatch } from "@/lib/insurance-intake-process";
import { parseIntakeProfile, type IntakeExtractionProfile } from "@/lib/insurance-intake-profile";
import { parsePythonIntakeRecords, mapPythonRecordsToIntakeExtraction } from "@/lib/insurance-intake-python-import";
import { computeAvailableSlots } from "@/lib/available-slots";
import { computeAbaTrainingSlots } from "@/lib/aba-training-slots";
import { startIntakeConversation, pushIntakeUpdate, setIntakeAwaitingSlot } from "@/lib/twilio-intake-bot";
import { dispatchAnamnesisPrefillRequest } from "@/lib/anamnesis-prefill";

type SimpleResult = { success: true } | { success: false; error: string };
type UrlResult = { success: true; url: string } | { success: false; error: string };
type LeadOutcome = { leadId: string; success: boolean; error?: string };

const DOCUMENTS_BUCKET = "clinic-documents";
const SIGNED_URL_TTL_SECONDS = 900;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const REJECT_REASON_LABEL: Record<string, string> = {
  ilegivel: "os documentos ficaram ilegíveis (imagem borrada ou muito escura)",
  incompleto: "faltou parte do documento (página ou verso)",
  vencido: "a carteirinha/guia enviada está vencida",
  documento_errado: "o documento enviado não corresponde ao que pedimos",
  outro: "precisamos que você reenvie os documentos",
};

async function requireSupervisor(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login de novo." };
  return { userId: user.id };
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "arquivo.pdf";
}

/** Sobe o PDF do lote e agenda a extração (cron pega em até 1min, ou o botão "Reprocessar" força na hora). */
export async function uploadIntakeBatch(formData: FormData): Promise<{ success: true; batchId: string } | { success: false; error: string }> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const file = formData.get("file");
  const insurerIdRaw = String(formData.get("insurer_id") ?? "").trim();
  const insurerId = insurerIdRaw && insurerIdRaw !== "auto" ? insurerIdRaw : null;

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione o PDF enviado pelo convênio." };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "Só arquivos PDF são aceitos nesta remessa." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "Arquivo maior que 25MB — não é possível enviar." };
  }

  const supabase = await createClient();
  const batchId = randomUUID();
  const storagePath = `intake/batches/${batchId}/${sanitizeFileName(file.name)}`;

  const { error: insertError } = await supabase.from("insurance_intake_batches").insert({
    id: batchId,
    clinic_id: DEV_CLINIC_ID,
    insurer_id: insurerId,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: "application/pdf",
    size_bytes: file.size,
    status: "pending",
    uploaded_by: auth.userId,
  });
  if (insertError) {
    return { success: false, error: "Você não tem permissão para enviar remessas de acolhimento." };
  }

  const admin = createAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, arrayBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    await admin.from("insurance_intake_batches").update({ status: "failed", error: "Falha ao subir o arquivo." }).eq("id", batchId);
    return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };
  }

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_batches",
    row_id: batchId,
    action: "intake_batch_uploaded",
    actor_id: auth.userId,
    clinic_id: DEV_CLINIC_ID,
    after: { insurer_id: insurerId, original_name: file.name },
  });

  // Processa já, sem esperar o próximo minuto do cron — `after()` roda
  // depois da resposta ser entregue, mas ainda dentro do tempo de vida da
  // função serverless (maxDuration), diferente de só disparar a Promise sem
  // aguardar (que pode ser encerrada no meio em ambientes serverless). Se
  // falhar aqui mesmo assim, o cron cobre no minuto seguinte.
  after(() => claimAndProcessIntakeBatches({ batchId }).catch((err) => console.error("[Intake] Falha ao processar lote na hora:", err)));

  revalidatePath("/supervisao");
  return { success: true, batchId };
}

/**
 * Caminho complementar a `uploadIntakeBatch`: em vez do PDF bruto (extraído
 * por Gemini/regex nativo), recebe o .json já estruturado que o supervisor
 * gerou localmente com `scripts/extract_convenio_patients.py` — útil para
 * layouts conhecidos (ex.: "CONTROLE PORTO TERAPIAS"/NAU Unimed) em que o
 * parser em tabela do script é mais confiável que o texto linearizado do
 * PDF. Não passa pela IA nem pelo cron: cria o lote e já grava os leads.
 */
export async function uploadIntakeExtractedBatch(formData: FormData): Promise<{ success: true; batchId: string } | { success: false; error: string }> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const file = formData.get("file");
  const insurerIdRaw = String(formData.get("insurer_id") ?? "").trim();
  const insurerId = insurerIdRaw && insurerIdRaw !== "auto" ? insurerIdRaw : null;

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione o arquivo .json gerado pelo script de extração." };
  }
  if (!file.name.toLowerCase().endsWith(".json")) {
    return { success: false, error: "Esta remessa aceita apenas o .json gerado por scripts/extract_convenio_patients.py." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "Arquivo maior que 25MB — não é possível enviar." };
  }

  const fileText = await file.text();
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(fileText);
  } catch {
    return { success: false, error: "O arquivo não é um JSON válido." };
  }

  const records = parsePythonIntakeRecords(rawJson);
  if (records.length === 0) {
    return { success: false, error: "Nenhum paciente reconhecido no JSON enviado — confira se é a saída do script." };
  }

  const supabase = await createClient();
  const batchId = randomUUID();
  const storagePath = `intake/batches/${batchId}/${sanitizeFileName(file.name)}`;

  const { error: insertError } = await supabase.from("insurance_intake_batches").insert({
    id: batchId,
    clinic_id: DEV_CLINIC_ID,
    insurer_id: insurerId,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: "application/json",
    size_bytes: file.size,
    status: "pending",
    uploaded_by: auth.userId,
  });
  if (insertError) {
    return { success: false, error: "Você não tem permissão para enviar remessas de acolhimento." };
  }

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, fileText, {
    contentType: "application/json",
    upsert: false,
  });
  if (uploadError) {
    await admin.from("insurance_intake_batches").update({ status: "failed", error: "Falha ao subir o arquivo." }).eq("id", batchId);
    return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };
  }

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_batches",
    row_id: batchId,
    action: "intake_batch_uploaded",
    actor_id: auth.userId,
    clinic_id: DEV_CLINIC_ID,
    after: { insurer_id: insurerId, original_name: file.name, source: "python_table_extraction" },
  });

  const insurerName = insurerId ? (await supabase.from("insurers").select("name").eq("id", insurerId).maybeSingle()).data?.name ?? null : null;
  const extraction = mapPythonRecordsToIntakeExtraction(records, insurerName);
  const outcome = await ingestPreExtractedIntakeBatch({ id: batchId, clinic_id: DEV_CLINIC_ID, insurer_id: insurerId }, extraction, "python-table");

  if (outcome.status === "failed") {
    return { success: false, error: outcome.error ?? "Falha ao processar o arquivo importado." };
  }

  revalidatePath("/supervisao");
  return { success: true, batchId };
}

export async function reprocessIntakeBatch(batchId: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const { data: batch } = await supabase.from("insurance_intake_batches").select("id").eq("id", batchId).maybeSingle();
  if (!batch) return { success: false, error: "Lote não encontrado." };

  const results = await claimAndProcessIntakeBatches({ batchId });
  const result = results[0];
  if (!result || result.status === "failed") {
    return { success: false, error: result?.error ?? "Não foi possível reprocessar agora." };
  }
  revalidatePath("/supervisao");
  return { success: true };
}

const EDITABLE_LEAD_FIELDS = new Set([
  "patient_full_name",
  "patient_birth_date",
  "patient_cpf",
  "patient_sexo",
  "patient_cid",
  "guardian_full_name",
  "guardian_cpf",
  "guardian_relationship",
  "guardian_email",
  "phone_e164",
  "card_number",
  "plan_name",
  "card_valid_until",
  "guide_number",
  "procedure_code",
  "sessions_authorized",
  "valid_from",
  "valid_to",
  "authorization_password",
]);

/** Edição inline de um campo extraído — usado antes de aprovar/iniciar contato. */
export async function updateIntakeLeadFields(leadId: string, patch: Record<string, string>): Promise<SimpleResult> {
  const supabase = await createClient();
  const { data: lead } = await supabase.from("insurance_intake_leads").select("status").eq("id", leadId).maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (!["extracted", "failed", "awaiting_documents"].includes(lead.status)) {
    return { success: false, error: "Este acolhimento já avançou no fluxo e não pode mais ser editado aqui." };
  }

  const update: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(patch)) {
    if (!EDITABLE_LEAD_FIELDS.has(key)) continue;
    const value = raw.trim();
    if (key === "patient_cpf" || key === "guardian_cpf") {
      update[key] = value ? normalizeCpf(value) : null;
    } else if (key === "patient_birth_date" || key === "card_valid_until" || key === "valid_from" || key === "valid_to") {
      update[key] = value ? parseBrDate(value) || value : null;
    } else if (key === "phone_e164") {
      update[key] = value ? normalizePhone(value) : null;
    } else if (key === "sessions_authorized") {
      update[key] = value ? Number(value) || null : null;
    } else {
      update[key] = value || null;
    }
  }
  if (Object.keys(update).length === 0) return { success: true };

  update.updated_at = new Date().toISOString();
  // Chaves montadas dinamicamente a partir da whitelist EDITABLE_LEAD_FIELDS
  // acima — o cast só contorna o índice genérico de Record<string,unknown>,
  // não abre campo novo (o whitelist já filtrou tudo antes daqui).
  const { error } = await supabase.from("insurance_intake_leads").update(update as never).eq("id", leadId);
  if (error) return { success: false, error: "Não foi possível salvar as alterações." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Aprova um ou mais leads e inicia o contato via WhatsApp. Cria
 * paciente('interessado')/responsável (ou vincula a um duplicado já
 * detectado), a conversa multicanal, e dispara a 1ª mensagem do bot. Cada
 * lead é tratado de forma independente — falha em um não impede os demais.
 */
export async function approveIntakeLeadsAndStartContact(leadIds: string[]): Promise<{ results: LeadOutcome[] }> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { results: leadIds.map((leadId) => ({ leadId, success: false, error: auth.error })) };

  const supabase = await createClient();
  const admin = createAdminClient();
  const results: LeadOutcome[] = [];

  for (const leadId of leadIds) {
    const { data: lead } = await supabase.from("insurance_intake_leads").select("*").eq("id", leadId).maybeSingle();
    if (!lead) {
      results.push({ leadId, success: false, error: "Acolhimento não encontrado." });
      continue;
    }
    if (lead.status !== "extracted" && lead.status !== "failed") {
      results.push({ leadId, success: false, error: "Este acolhimento já foi processado." });
      continue;
    }
    if (!lead.patient_full_name || !lead.patient_birth_date || !lead.phone_e164) {
      results.push({ leadId, success: false, error: "Preencha nome, data de nascimento e telefone antes de aprovar." });
      continue;
    }

    // Outro lead ativo já usando este telefone? (índice único no banco é a
    // rede de segurança final; esta checagem evita a corrida mais comum e
    // dá uma mensagem legível.)
    const { count: activeCount } = await admin
      .from("insurance_intake_leads")
      .select("id", { count: "exact", head: true })
      .eq("phone_e164", lead.phone_e164)
      .neq("id", leadId)
      .in("status", ["awaiting_documents", "pending_supervisor", "awaiting_slot", "pending_confirmation"]);
    if ((activeCount ?? 0) > 0) {
      results.push({ leadId, success: false, error: "Já existe outro acolhimento em andamento para este telefone." });
      continue;
    }

    let patientId = lead.duplicate_patient_id;
    if (!patientId) {
      const { data: created, error } = await supabase
        .from("patients")
        .insert({
          clinic_id: DEV_CLINIC_ID,
          full_name: lead.patient_full_name,
          birth_date: lead.patient_birth_date,
          cpf: lead.patient_cpf,
          sexo: lead.patient_sexo,
          cid: lead.patient_cid,
          status: "interessado",
          entry_source: "acolhimento_plano_saude",
          first_contact_at: new Date().toISOString(),
          created_by: auth.userId,
        })
        .select("id")
        .single();
      if (error || !created) {
        results.push({ leadId, success: false, error: "Não foi possível criar o paciente (CPF já cadastrado?)." });
        continue;
      }
      patientId = created.id;
      // Idempotência: se o resto falhar, uma nova tentativa encontra o paciente já criado.
      await admin.from("insurance_intake_leads").update({ patient_id: patientId }).eq("id", leadId);
    } else {
      // Paciente já cadastrado (duplicata por CPF/telefone): completa só os
      // campos que a ficha ainda não tem — nunca sobrescreve o que já foi
      // preenchido manualmente.
      const { data: existingPatient } = await supabase.from("patients").select("cpf, sexo, cid").eq("id", patientId).maybeSingle();
      if (existingPatient) {
        const patch: Record<string, unknown> = {};
        if (!existingPatient.cpf && lead.patient_cpf) patch.cpf = lead.patient_cpf;
        if (!existingPatient.sexo && lead.patient_sexo) patch.sexo = lead.patient_sexo;
        if (!existingPatient.cid && lead.patient_cid) patch.cid = lead.patient_cid;
        if (Object.keys(patch).length > 0) await supabase.from("patients").update(patch as never).eq("id", patientId);
      }
    }

    const { data: existingGuardian } = await supabase
      .from("guardians")
      .select("id, cpf, email, relationship")
      .eq("patient_id", patientId)
      .eq("phone", lead.phone_e164)
      .maybeSingle();

    let guardianId = existingGuardian?.id ?? null;
    if (!guardianId) {
      const { data: createdGuardian, error: guardianError } = await supabase
        .from("guardians")
        .insert({
          patient_id: patientId,
          full_name: lead.guardian_full_name || "Responsável",
          phone: lead.phone_e164,
          cpf: lead.guardian_cpf,
          email: lead.guardian_email,
          relationship: lead.guardian_relationship,
          is_financial: true,
        })
        .select("id")
        .single();
      if (guardianError || !createdGuardian) {
        results.push({ leadId, success: false, error: "Paciente criado, mas houve erro ao salvar o responsável." });
        continue;
      }
      guardianId = createdGuardian.id;
    } else if (existingGuardian) {
      const patch: Record<string, unknown> = {};
      if (!existingGuardian.cpf && lead.guardian_cpf) patch.cpf = lead.guardian_cpf;
      if (!existingGuardian.email && lead.guardian_email) patch.email = lead.guardian_email;
      if (!existingGuardian.relationship && lead.guardian_relationship) patch.relationship = lead.guardian_relationship;
      if (Object.keys(patch).length > 0) await supabase.from("guardians").update(patch as never).eq("id", existingGuardian.id);
    }

    await admin.from("insurance_intake_leads").update({ patient_id: patientId, guardian_id: guardianId }).eq("id", leadId);

    const start = await startIntakeConversation(leadId);
    if (!start.success) {
      await admin
        .from("insurance_intake_leads")
        .update({ status: "failed", status_reason: start.error ?? "Falha ao enviar WhatsApp." })
        .eq("id", leadId);
      results.push({ leadId, success: false, error: start.error ?? "Falha ao enviar mensagem via WhatsApp." });
      continue;
    }

    await admin
      .from("insurance_intake_leads")
      .update({
        status: "awaiting_documents",
        approved_at: new Date().toISOString(),
        approved_by: auth.userId,
        contact_sent_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    await admin.from("audit_log").insert([
      { table_name: "insurance_intake_leads", row_id: leadId, action: "intake_lead_approved", actor_id: auth.userId, clinic_id: lead.clinic_id, after: { patient_id: patientId } },
      { table_name: "insurance_intake_leads", row_id: leadId, action: "intake_contact_sent", actor_id: auth.userId, clinic_id: lead.clinic_id },
    ]);

    results.push({ leadId, success: true });
  }

  revalidatePath("/supervisao");
  return { results };
}

/** Aprova/rejeita um arquivo específico recebido do responsável; classifica o tipo (Laudo/Guia/Outro). */
export async function reviewIntakeLeadFile(fileId: string, patch: { kind?: "laudo" | "guia" | "outro"; decision?: "approved" | "rejected" }): Promise<SimpleResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.kind) update.kind = patch.kind;
  if (patch.decision) {
    update.review_status = patch.decision;
    update.reviewed_at = new Date().toISOString();
    update.reviewed_by = auth.userId;
  }
  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await supabase.from("insurance_intake_lead_files").update(update as never).eq("id", fileId);
  if (error) return { success: false, error: "Não foi possível salvar a classificação do arquivo." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
/**
 * O que a família vai escolher no WhatsApp: a sessão de avaliação de 50min
 * (padrão histórico) ou um bloco de 2h de Treino ABA numa turma. O Treino
 * ABA não cabe no cálculo de horário livre de sala+terapeuta — ele é encaixe
 * em turma fixa (8/10/14/16h) — então a lista de opções vem de outra fonte,
 * mas o resto do fluxo (bot, escolha por número, aprovação do supervisor) é
 * o mesmo.
 */
export type IntakeOfferKind = "avaliacao" | "treino_aba";

type OfferedSlotRow = {
  index: number;
  label: string;
  starts_at: string;
  ends_at: string;
  therapist_id: string;
  room_id: string;
  aba_class_id?: string | null;
};

/**
 * Monta a lista de opções que vai pro WhatsApp, no formato que
 * `setIntakeAwaitingSlot`/`processIntakeBotStep` esperam. Devolve lista
 * vazia quando não há vaga — quem chama decide a mensagem de erro.
 */
async function buildOfferedSlots(
  admin: ReturnType<typeof createAdminClient>,
  params: { kind: IntakeOfferKind; clinicId: string; therapistId: string; roomId: string },
): Promise<OfferedSlotRow[]> {
  if (params.kind === "treino_aba") {
    const { data: treinoType } = await admin
      .from("appointment_types")
      .select("duration_minutes")
      .eq("clinic_id", params.clinicId)
      .eq("aba_role", "treino")
      .eq("active", true)
      .maybeSingle();

    const slots = await computeAbaTrainingSlots(admin, {
      clinicId: params.clinicId,
      durationMinutes: treinoType?.duration_minutes ?? 120,
      limit: 3,
      maxPerDay: 1,
    });

    return slots.map((s, index) => ({
      index: index + 1,
      label: `${s.label} · bloco de 2h em ${s.roomName}`,
      starts_at: s.startsAtIso,
      ends_at: s.endsAtIso,
      therapist_id: params.therapistId,
      room_id: s.roomId,
      aba_class_id: s.classId,
    }));
  }

  const rawSlots = await computeAvailableSlots(admin, {
    therapistId: params.therapistId,
    roomId: params.roomId,
    durationMinutes: 50,
    limit: 3,
    maxPerDay: 2,
  });

  return rawSlots.map((s, index) => ({
    index: index + 1,
    label: `${s.dateLabel} às ${s.timeLabel}`,
    starts_at: s.startsAtIso,
    ends_at: s.endsAtIso,
    therapist_id: params.therapistId,
    room_id: params.roomId,
  }));
}

/**
 * Aprova os documentos do lead: promove os arquivos aprovados para
 * `documents`, cria/atualiza convênio e guia de autorização do paciente, e
 * envia os horários vagos por WhatsApp. Nenhum agendamento é criado aqui —
 * isso só acontece quando o responsável escolhe um horário (RPC
 * book_intake_lead_slot_atomic, disparada pelo bot).
 */
export async function approveIntakeLeadDocuments(
  leadId: string,
  therapistId: string,
  roomId: string,
  offerKind: IntakeOfferKind = "avaliacao",
): Promise<SimpleResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };
  // No Treino ABA a sala vem da turma escolhida pela família, não daqui —
  // só o terapeuta responsável pelo bloco continua sendo escolha do supervisor.
  if (!therapistId) return { success: false, error: "Selecione o terapeuta." };
  if (offerKind === "avaliacao" && !roomId) return { success: false, error: "Selecione o terapeuta e a sala da avaliação." };

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: lead } = await supabase.from("insurance_intake_leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (lead.status !== "pending_supervisor") return { success: false, error: "Este acolhimento não está aguardando validação de documentos." };
  if (!lead.patient_id) return { success: false, error: "Acolhimento sem paciente vinculado." };

  const { data: files } = await admin
    .from("insurance_intake_lead_files")
    .select("id, storage_path, mime_type, kind, review_status, document_id")
    .eq("lead_id", leadId);
  const approvedFiles = (files ?? []).filter((f) => f.review_status === "approved" && !f.document_id);
  if (approvedFiles.length === 0) {
    return { success: false, error: "Aprove ao menos um arquivo (Laudo ou Guia) antes de continuar." };
  }

  const warnings: string[] = [];

  for (const file of approvedFiles) {
    const category = file.kind === "guia" ? "autorizacao" : file.kind === "laudo" ? "laudo" : "outro";
    const documentId = randomUUID();
    const fileName = file.storage_path.split("/").pop() ?? "arquivo";
    const destPath = `${lead.patient_id}/${documentId}/${fileName}`;

    const { error: copyError } = await admin.storage.from(DOCUMENTS_BUCKET).copy(file.storage_path, destPath);
    if (copyError) {
      warnings.push("Não foi possível anexar um dos arquivos recebidos pelo WhatsApp.");
      continue;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      patient_id: lead.patient_id,
      category,
      storage_path: destPath,
      uploaded_by: auth.userId,
      shared_with_family: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
      note: "Enviado por WhatsApp — acolhimento oriundo de plano de saúde",
    });
    if (insertError) {
      await admin.storage.from(DOCUMENTS_BUCKET).remove([destPath]);
      warnings.push("Não foi possível salvar um dos arquivos no prontuário.");
      continue;
    }
    await admin.from("insurance_intake_lead_files").update({ document_id: documentId }).eq("id", file.id);
  }

  // --- Convênio + guia de autorização --------------------------------
  if (lead.insurer_id) {
    const { data: existingInsurance } = await supabase
      .from("patient_insurance")
      .select("id")
      .eq("patient_id", lead.patient_id)
      .eq("insurer_id", lead.insurer_id)
      .maybeSingle();

    let patientInsuranceId = existingInsurance?.id ?? null;
    if (!patientInsuranceId) {
      const { data: created, error } = await supabase
        .from("patient_insurance")
        .insert({
          patient_id: lead.patient_id,
          insurer_id: lead.insurer_id,
          card_number: lead.card_number,
          plan_name: lead.plan_name,
          card_valid_until: lead.card_valid_until,
          is_private: false,
        })
        .select("id")
        .single();
      if (!error && created) patientInsuranceId = created.id;
    } else {
      await supabase
        .from("patient_insurance")
        .update({
          ...(lead.card_number ? { card_number: lead.card_number } : {}),
          ...(lead.plan_name ? { plan_name: lead.plan_name } : {}),
          ...(lead.card_valid_until ? { card_valid_until: lead.card_valid_until } : {}),
        })
        .eq("id", patientInsuranceId);
    }

    if (patientInsuranceId) {
      const { data: insurer } = await admin.from("insurers").select("intake_extraction_profile").eq("id", lead.insurer_id).maybeSingle();
      const profile: IntakeExtractionProfile | undefined = insurer ? parseIntakeProfile(insurer.intake_extraction_profile) : undefined;
      const procedureCode = lead.procedure_code || profile?.procedure_code_default || null;

      const sessionsAuthorized = lead.sessions_authorized ?? 0;
      if (procedureCode && sessionsAuthorized > 0 && lead.valid_from && lead.valid_to) {
        const guiaFile = files?.find((f) => f.kind === "guia" && f.document_id);
        const { data: authRow, error: authError } = await supabase
          .from("authorizations")
          .insert({
            patient_insurance_id: patientInsuranceId,
            guide_number: lead.guide_number,
            procedure_code: procedureCode,
            sessions_authorized: sessionsAuthorized,
            valid_from: lead.valid_from,
            valid_to: lead.valid_to,
            status: "ativa",
            requested_at: new Date().toISOString(),
            document_id: guiaFile?.document_id ?? null,
            authorization_password: lead.authorization_password,
          })
          .select("id")
          .single();
        if (authError || !authRow) {
          warnings.push("Convênio vinculado, mas não foi possível registrar a guia de autorização.");
        } else {
          await supabase.from("insurance_intake_leads").update({ patient_insurance_id: patientInsuranceId, authorization_id: authRow.id }).eq("id", leadId);
        }
      } else {
        warnings.push("Guia não cadastrada automaticamente: faltou procedimento, sessões autorizadas ou vigência — cadastre manualmente se necessário.");
        await supabase.from("insurance_intake_leads").update({ patient_insurance_id: patientInsuranceId }).eq("id", leadId);
      }
    }
  }

  // --- Horários vagos --------------------------------------------------
  const offeredSlots = await buildOfferedSlots(admin, {
    kind: offerKind,
    clinicId: lead.clinic_id,
    therapistId,
    roomId,
  });
  if (offeredSlots.length === 0) {
    return {
      success: false,
      error:
        offerKind === "treino_aba"
          ? "Sem vaga nas turmas de Treino ABA nos próximos dias — abra uma turma ou libere vaga antes de enviar."
          : "Sem horários livres nos próximos dias para esse terapeuta/sala — tente outra combinação.",
    };
  }

  // Aviso (não bloqueio): o bloco de 2h consome 3 sessões somadas das guias
  // ABA no fechamento; se a guia recém-cadastrada não for de um dos
  // procedimentos do bolso, a sessão é agendada mas não fecha depois.
  if (offerKind === "treino_aba") {
    const { data: balance } = await admin.rpc("aba_training_balance", { p_patient_id: lead.patient_id });
    const blocks = Array.isArray(balance) ? (balance[0]?.blocks_available ?? 0) : 0;
    if (blocks < 1) {
      warnings.push("Paciente ainda sem saldo nas guias ABA para um bloco de 2h — confira as guias antes da sessão acontecer.");
    }
  }

  await setIntakeAwaitingSlot(leadId, lead.phone_e164!, offeredSlots);

  const slotListText = offeredSlots.map((s) => `*${s.index}* - ${s.label}`).join("\n");
  const messageText =
    offerKind === "treino_aba"
      ? `✅ *Documentos aprovados!*\n\n` +
        `Os documentos de *${lead.patient_full_name}* foram conferidos pela nossa equipe. O *Treino ABA* acontece em bloco de *2 horas* (3 sessões de 40min), em turma. Escolha o horário respondendo com o *número*:\n\n${slotListText}\n\n` +
        "Responda apenas com o número escolhido."
      : `✅ *Documentos aprovados!*\n\n` +
        `Os documentos de *${lead.patient_full_name}* foram conferidos pela nossa equipe. Escolha o horário da avaliação respondendo com o *número*:\n\n${slotListText}\n\n` +
        "Responda apenas com o número escolhido.";
  const pushResult = await pushIntakeUpdate(leadId, messageText);
  if (!pushResult.success) warnings.push("Documentos aprovados, mas não foi possível enviar a lista de horários por WhatsApp agora.");

  await supabase
    .from("insurance_intake_leads")
    .update({
      status: "awaiting_slot",
      offered_slots: offeredSlots,
      slots_sent_at: new Date().toISOString(),
      docs_reviewed_at: new Date().toISOString(),
      docs_reviewed_by: auth.userId,
    })
    .eq("id", leadId);

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_leads",
    row_id: leadId,
    action: "intake_docs_approved",
    actor_id: auth.userId,
    clinic_id: lead.clinic_id,
    after: { warnings },
  });

  revalidatePath("/supervisao");
  return warnings.length > 0 ? { success: false, error: warnings.join(" ") } : { success: true };
}

export async function rejectIntakeLeadDocuments(leadId: string, reasonCode: string): Promise<SimpleResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: lead } = await supabase.from("insurance_intake_leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (lead.status !== "pending_supervisor") return { success: false, error: "Este acolhimento não está aguardando validação de documentos." };

  await admin
    .from("insurance_intake_lead_files")
    .update({ review_status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: auth.userId })
    .eq("lead_id", leadId)
    .eq("review_status", "pending");

  await admin
    .from("chatbot_sessions")
    .update({ current_step: "intake_awaiting_documents", updated_at: new Date().toISOString() })
    .eq("phone_number", lead.phone_e164 ?? "")
    .eq("lead_id", leadId);

  await supabase
    .from("insurance_intake_leads")
    .update({
      status: "awaiting_documents",
      rejection_count: (lead.rejection_count ?? 0) + 1,
      docs_reviewed_at: new Date().toISOString(),
      docs_reviewed_by: auth.userId,
    })
    .eq("id", leadId);

  const reasonText = REJECT_REASON_LABEL[reasonCode] ?? REJECT_REASON_LABEL.outro;
  const pushResult = await pushIntakeUpdate(
    leadId,
    `Olá! Sobre os documentos de *${lead.patient_full_name ?? "seu(sua) filho(a)"}*: ${reasonText}. Pode enviar novamente por aqui? 🙏`,
  );

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_leads",
    row_id: leadId,
    action: "intake_docs_rejected",
    actor_id: auth.userId,
    clinic_id: lead.clinic_id,
    after: { reason: reasonCode },
  });

  revalidatePath("/supervisao");
  return pushResult.success ? { success: true } : { success: false, error: "Rejeição registrada, mas não foi possível avisar por WhatsApp agora." };
}

export async function cancelIntakeLead(leadId: string, reason?: string): Promise<SimpleResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: lead } = await supabase.from("insurance_intake_leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (["scheduled", "cancelled"].includes(lead.status)) {
    return { success: false, error: "Este acolhimento não pode mais ser cancelado." };
  }

  await supabase
    .from("insurance_intake_leads")
    .update({ status: "cancelled", status_reason: reason ?? null, cancelled_at: new Date().toISOString(), cancelled_by: auth.userId })
    .eq("id", leadId);

  if (lead.phone_e164) {
    await admin.from("chatbot_sessions").update({ current_step: "idle" }).eq("phone_number", lead.phone_e164).eq("lead_id", leadId);
  }

  // Paciente criado só por causa deste lead e sem nenhum agendamento — arquiva.
  if (lead.patient_id) {
    const { count: apptCount } = await admin.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", lead.patient_id);
    if (!apptCount) {
      await admin.from("patients").update({ status: "arquivado" }).eq("id", lead.patient_id).eq("entry_source", "acolhimento_plano_saude");
    }
  }

  // Arquivos ainda não promovidos a `documents` são removidos (LGPD: não
  // reter documento de terceiro de um acolhimento cancelado).
  const { data: files } = await admin.from("insurance_intake_lead_files").select("storage_path, document_id").eq("lead_id", leadId);
  const orphanPaths = (files ?? []).filter((f) => !f.document_id).map((f) => f.storage_path);
  if (orphanPaths.length > 0) {
    await admin.storage.from(DOCUMENTS_BUCKET).remove(orphanPaths);
  }

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_leads",
    row_id: leadId,
    action: "intake_lead_cancelled",
    actor_id: auth.userId,
    clinic_id: lead.clinic_id,
    after: { reason: reason ?? null },
  });

  revalidatePath("/supervisao");
  return { success: true };
}

/** Reenvia por WhatsApp a lista de horários já oferecida (responsável perdeu a mensagem, ou pediu de novo). */
export async function resendIntakeSlots(leadId: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const { data: lead } = await supabase.from("insurance_intake_leads").select("status, offered_slots, patient_full_name").eq("id", leadId).maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (lead.status !== "awaiting_slot" || !lead.offered_slots) {
    return { success: false, error: "Este acolhimento não está aguardando escolha de horário." };
  }

  const slots = lead.offered_slots as { index: number; label: string; aba_class_id?: string | null }[];
  const slotListText = slots.map((s) => `*${s.index}* - ${s.label}`).join("\n");
  // Reenvia a oferta já gravada no lead — só muda o rótulo do que está sendo
  // oferecido (avaliação de 50min ou bloco de 2h de Treino ABA).
  const whatLabel = slots.some((s) => s.aba_class_id) ? "o Treino ABA (bloco de 2h)" : "a avaliação";
  const result = await pushIntakeUpdate(
    leadId,
    `Lembrando: os horários disponíveis para ${whatLabel} de *${lead.patient_full_name ?? "seu(sua) filho(a)"}* são:\n\n${slotListText}\n\nResponda apenas com o número escolhido.`,
  );
  if (!result.success) return { success: false, error: "Não foi possível reenviar a mensagem agora." };
  return { success: true };
}

/**
 * Supervisor confirma o horário que a família reservou (lead em
 * 'pending_confirmation'): a RPC só troca o status pra 'scheduled' — o
 * appointment já existe desde a reserva (book_intake_lead_slot_atomic) —
 * e aqui disparamos a mensagem final de confirmação por WhatsApp.
 */
export async function confirmIntakeLeadAppointment(leadId: string): Promise<SimpleResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: lead } = await supabase
    .from("insurance_intake_leads")
    .select("id, clinic_id, patient_id, patient_full_name, appointment_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };

  const { data: rpcResult, error: rpcErr } = await admin.rpc("confirm_intake_lead_appointment", {
    p_lead_id: leadId,
    p_confirmed_by: auth.userId,
  });
  const resObj = rpcResult as { success?: boolean; error?: string } | null;
  if (rpcErr || !resObj?.success) {
    return { success: false, error: resObj?.error ?? rpcErr?.message ?? "Erro ao confirmar agendamento." };
  }

  const { data: appt } = lead.appointment_id
    ? await admin.from("appointments").select("starts_at").eq("id", lead.appointment_id).maybeSingle()
    : { data: null };
  const formattedDate = appt?.starts_at
    ? new Date(appt.starts_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, dateStyle: "full", timeStyle: "short" })
    : null;

  const messageText =
    `✅ *AVALIAÇÃO CONFIRMADA!*\n\n` +
    `👤 *Paciente:* ${lead.patient_full_name ?? "—"}\n` +
    (formattedDate ? `📅 *Data e horário:* ${formattedDate}\n\n` : "\n") +
    "Traga os documentos originais no dia. Em instantes você recebe por aqui o convite para preencher a anamnese antes da consulta. Qualquer dúvida, é só responder por aqui. Até breve!";

  // Cumpre o que o bot prometeu ao oferecer os horários (lib/twilio-intake-bot.ts):
  // "você receberá a confirmação final ... junto com o link para o formulário de
  // anamnese". Mesmo disparo usado no agendamento manual pela recepção
  // (app/recepcao/pacientes/[id]/stage-actions.ts::scheduleEvaluation) — falha
  // graciosamente sem bloquear a confirmação se não houver responsável/Twilio.
  if (lead.patient_id && lead.appointment_id && appt?.starts_at) {
    await dispatchAnamnesisPrefillRequest({ patientId: lead.patient_id, appointmentId: lead.appointment_id, startsAt: appt.starts_at });
  }
  const pushResult = await pushIntakeUpdate(leadId, messageText);

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_leads",
    row_id: leadId,
    action: "intake_appointment_confirmed",
    actor_id: auth.userId,
    clinic_id: lead.clinic_id,
    after: {},
  });

  revalidatePath("/supervisao");
  return pushResult.success ? { success: true } : { success: false, error: "Agendamento confirmado, mas não foi possível avisar por WhatsApp agora." };
}

/**
 * Supervisor recusa o horário que a família reservou: cancela o
 * appointment (RPC), recalcula até 3 novas opções pro mesmo
 * terapeuta/sala e reenvia a lista — mesmo texto/formato da primeira
 * oferta em approveIntakeLeadDocuments.
 */
export async function rejectIntakeLeadAppointment(leadId: string): Promise<SimpleResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: lead } = await supabase
    .from("insurance_intake_leads")
    .select("id, clinic_id, patient_full_name, phone_e164, appointment_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (!lead.appointment_id) return { success: false, error: "Este acolhimento não tem agendamento reservado." };

  const { data: appt } = await admin
    .from("appointments")
    .select("therapist_id, room_id, aba_class_id")
    .eq("id", lead.appointment_id)
    .maybeSingle();
  if (!appt) return { success: false, error: "Agendamento reservado não encontrado." };

  const { data: rpcResult, error: rpcErr } = await admin.rpc("reject_intake_lead_appointment", {
    p_lead_id: leadId,
    p_rejected_by: auth.userId,
  });
  const resObj = rpcResult as { success?: boolean; error?: string } | null;
  if (rpcErr || !resObj?.success) {
    return { success: false, error: resObj?.error ?? rpcErr?.message ?? "Erro ao recusar agendamento." };
  }

  // A reoferta segue o mesmo tipo do agendamento recusado: bloco de turma
  // se a sessão era Treino ABA, sessão de 50min caso contrário.
  const rejectedKind: IntakeOfferKind = appt.aba_class_id ? "treino_aba" : "avaliacao";
  const offeredSlots = await buildOfferedSlots(admin, {
    kind: rejectedKind,
    clinicId: lead.clinic_id,
    therapistId: appt.therapist_id,
    roomId: appt.room_id,
  });

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_leads",
    row_id: leadId,
    action: "intake_appointment_rejected",
    actor_id: auth.userId,
    clinic_id: lead.clinic_id,
    after: { new_slots_found: offeredSlots.length, offer_kind: rejectedKind },
  });
  revalidatePath("/supervisao");

  if (offeredSlots.length === 0) {
    return {
      success: false,
      error:
        rejectedKind === "treino_aba"
          ? "Agendamento recusado, mas não há mais vaga nas turmas de Treino ABA — contate a família manualmente."
          : "Agendamento recusado, mas não há mais horários livres para esse terapeuta/sala — contate a família manualmente.",
    };
  }

  await setIntakeAwaitingSlot(leadId, lead.phone_e164!, offeredSlots);
  await admin
    .from("insurance_intake_leads")
    .update({ offered_slots: offeredSlots, slots_sent_at: new Date().toISOString() })
    .eq("id", leadId);

  const slotListText = offeredSlots.map((s) => `*${s.index}* - ${s.label}`).join("\n");
  const messageText =
    `Precisamos reagendar o horário ${rejectedKind === "treino_aba" ? "do Treino ABA (bloco de 2h)" : "da avaliação"} de *${lead.patient_full_name ?? "seu(sua) filho(a)"}*. Seguem novas opções:\n\n${slotListText}\n\n` +
    "Responda apenas com o número escolhido.";
  const pushResult = await pushIntakeUpdate(leadId, messageText);

  return pushResult.success ? { success: true } : { success: false, error: "Reagendamento processado, mas não foi possível enviar as novas opções por WhatsApp agora." };
}

export async function retryIntakeLead(leadId: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const { data: lead } = await supabase.from("insurance_intake_leads").select("status").eq("id", leadId).maybeSingle();
  if (!lead) return { success: false, error: "Acolhimento não encontrado." };
  if (lead.status !== "failed") return { success: false, error: "Só é possível tentar de novo um acolhimento que falhou." };

  const { error } = await supabase.from("insurance_intake_leads").update({ status: "extracted", status_reason: null }).eq("id", leadId);
  if (error) return { success: false, error: "Não foi possível reiniciar este acolhimento." };

  revalidatePath("/supervisao");
  return { success: true };
}

export async function getIntakeFileUrl(fileId: string): Promise<UrlResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("insurance_intake_lead_files")
    .select("id, storage_path, lead_id, insurance_intake_leads(clinic_id)")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { success: false, error: "Arquivo não encontrado." };

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) return { success: false, error: "Não foi possível gerar o link do arquivo." };

  const leadRef = Array.isArray(file.insurance_intake_leads) ? file.insurance_intake_leads[0] : file.insurance_intake_leads;
  await admin.from("audit_log").insert({
    table_name: "insurance_intake_lead_files",
    row_id: file.id,
    action: "download",
    actor_id: auth.userId,
    clinic_id: leadRef?.clinic_id ?? null,
  });

  return { success: true, url: signed.signedUrl };
}

export async function getIntakeBatchPdfUrl(batchId: string): Promise<UrlResult> {
  const auth = await requireSupervisor();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data: batch } = await supabase.from("insurance_intake_batches").select("id, storage_path, clinic_id").eq("id", batchId).maybeSingle();
  if (!batch) return { success: false, error: "Lote não encontrado." };

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(batch.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) return { success: false, error: "Não foi possível gerar o link do arquivo." };

  await admin.from("audit_log").insert({
    table_name: "insurance_intake_batches",
    row_id: batch.id,
    action: "download",
    actor_id: auth.userId,
    clinic_id: batch.clinic_id,
  });

  return { success: true, url: signed.signedUrl };
}
