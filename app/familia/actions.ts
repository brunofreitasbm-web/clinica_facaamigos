// app/familia/actions.ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ABSENCE_REASON_CATEGORIES } from "@/lib/absence-reasons";
import { currentSurveyPeriod } from "@/lib/survey-period";

type ActionResult = { success: true } | { success: false; error: string };
type UrlResult = { success: true; url: string } | { success: false; error: string };

// Mesmo teto usado em app/recepcao/pacientes/[id]/documents-actions.ts (PRD §11).
const SIGNED_URL_TTL_SECONDS = 900;
// Mesmo teto de tamanho de arquivo usado em documents-actions.ts.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "arquivo";
}

/**
 * "Fale com a Coordenação" (Familia.dc.html) — grava uma mensagem de
 * responsável para a clínica. A RLS de `messages` (messages_write,
 * 20260904000014_final_review_fixes.sql) é o portão real: só aceita o
 * insert se `has_patient_access(patient_id, array['responsavel'])` for
 * verdadeiro pro usuário logado, então não precisamos revalidar o vínculo
 * aqui — só formatar o INSERT com os valores certos do enum.
 *
 * channel/direction seguem o CHECK constraint de
 * supabase/migrations/20260904000012_audit_and_messages.sql:
 *   channel in ('whatsapp','portal'); direction in ('outbound','inbound').
 * 'outbound' já é usado pelas notificações que a clínica manda pro portal
 * (ex.: 20260904000019_reassessment_alerts.sql); uma mensagem que a família
 * está mandando PRA clínica é o sentido contrário: 'inbound'.
 */
export async function sendCoordinationMessage(
  patientId: string,
  guardianId: string | null,
  body: string,
): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { success: false, error: "Escreva uma mensagem antes de enviar." };
  }
  if (trimmed.length > 2000) {
    return { success: false, error: "Mensagem muito longa." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { error } = await supabase.from("messages").insert({
    patient_id: patientId,
    guardian_id: guardianId,
    channel: "portal",
    direction: "inbound",
    body: trimmed,
    sent_at: new Date().toISOString(),
  });

  if (error) {
    return {
      success: false,
      error: "Não foi possível enviar a mensagem. Tente de novo.",
    };
  }

  revalidatePath("/familia");
  return { success: true };
}

/**
 * "Confirmar presença" (§9.7) — delega pra `confirm_attendance` (security
 * definer, migration 20260904000030): a checagem de vínculo
 * (has_patient_access) e a guarda de status ('agendada' → 'confirmada')
 * vivem no banco, não aqui, porque RLS comum não restringe QUAIS colunas um
 * UPDATE altera — só a função evita que a família altere outra coisa da
 * sessão além da confirmação.
 */
export async function confirmAttendance(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { error } = await supabase.rpc("confirm_attendance", { p_appointment_id: appointmentId });

  if (error) {
    return { success: false, error: error.message || "Não foi possível confirmar a sessão." };
  }

  revalidatePath("/familia");
  return { success: true };
}

const RATING_VALUES = ["ruim", "regular", "bom", "otimo"] as const;

/**
 * Questionário trimestral (§9.7: "NPS + perguntas sobre recepção e
 * terapeuta"). Período é sempre o calculado no servidor (currentSurveyPeriod),
 * nunca o que vier do formulário — a constraint única
 * (patient_id, guardian_id, period, migration 20260904000031) é o que
 * garante uma resposta por trimestre, mas só faz sentido se o período for
 * confiável.
 */
export async function submitSurvey(
  patientId: string,
  guardianId: string,
  formData: FormData,
): Promise<ActionResult> {
  const npsRaw = formData.get("nps_score");
  const npsScore = Number(npsRaw);
  if (!Number.isInteger(npsScore) || npsScore < 0 || npsScore > 10) {
    return { success: false, error: "Selecione uma nota de 0 a 10." };
  }

  const recepcaoRating = String(formData.get("recepcao_rating") ?? "");
  const terapeutaRating = String(formData.get("terapeuta_rating") ?? "");
  if (!RATING_VALUES.includes(recepcaoRating as (typeof RATING_VALUES)[number])) {
    return { success: false, error: "Avalie a recepção." };
  }
  if (!RATING_VALUES.includes(terapeutaRating as (typeof RATING_VALUES)[number])) {
    return { success: false, error: "Avalie o terapeuta." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { error } = await supabase.from("survey_responses").insert({
    patient_id: patientId,
    guardian_id: guardianId,
    period: currentSurveyPeriod(),
    nps_score: npsScore,
    answers: { recepcao: recepcaoRating, terapeuta: terapeutaRating },
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Você já respondeu a pesquisa deste trimestre." };
    }
    return { success: false, error: "Não foi possível enviar sua resposta. Tente de novo." };
  }

  revalidatePath("/familia");
  return { success: true };
}

/**
 * "Informar Falta" (PRD §5) — o responsável avisa que a criança não vai
 * numa sessão futura. Categoria 'doenca' OU anexo (atestado/comprovante) já
 * aprova automaticamente e marca a sessão como falta justificada (trigger
 * absence_report_apply, 20260904000023_absence_reports.sql); as demais
 * categorias sem anexo ficam 'em_analise' até a recepção decidir
 * (app/recepcao/pacientes/[id]/absence-actions.ts).
 *
 * Upload ANTES do insert (ordem invertida em relação a
 * documents-actions.ts/getFamilyDocumentUrl): como o trigger já aprova e
 * muda o status da sessão assim que a linha existe com
 * attachment_storage_path preenchido, o arquivo precisa estar de fato no
 * bucket antes de criar a linha — senão a sessão viraria "falta
 * justificada" com um anexo que não existe.
 */
export async function reportAbsence(appointmentId: string, formData: FormData): Promise<ActionResult> {
  const reasonCategory = String(formData.get("reason_category") ?? "");
  const reasonText = String(formData.get("reason_text") ?? "").trim();
  const file = formData.get("attachment");

  if (!ABSENCE_REASON_CATEGORIES.some((c) => c.value === reasonCategory)) {
    return { success: false, error: "Selecione um motivo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && (file as File).size > MAX_FILE_BYTES) {
    return { success: false, error: "Arquivo maior que 25MB." };
  }

  const reportId = randomUUID();
  let storagePath: string | null = null;

  if (hasFile) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return {
        success: false,
        error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.",
      };
    }

    storagePath = `${appointmentId}/${reportId}-${sanitizeFileName((file as File).name)}`;
    const arrayBuffer = await (file as File).arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("absence-attachments")
      .upload(storagePath, arrayBuffer, {
        contentType: (file as File).type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: "Não foi possível enviar o anexo. Tente de novo." };
    }
  }

  // RLS (absence_reports_insert) é o portão real: só aceita se
  // has_patient_access(patient_id, array['responsavel']) for verdadeiro pro
  // usuário logado via o appointment informado.
  const { error: insertError } = await supabase.from("absence_reports").insert({
    id: reportId,
    appointment_id: appointmentId,
    reported_by: user.id,
    reason_category: reasonCategory,
    reason_text: reasonText || null,
    attachment_storage_path: storagePath,
  });

  if (insertError) {
    return {
      success: false,
      error: "Não foi possível registrar a falta. Verifique se esta sessão é sua.",
    };
  }

  revalidatePath("/familia");
  return { success: true };
}

/**
 * Link assinado de um documento liberado à família. Mesmo padrão de
 * app/recepcao/pacientes/[id]/documents-actions.ts (getDocumentUrl), mas
 * mantido como cópia dentro de app/familia/** (ao invés de importar do
 * outro screen) — telas concorrentes não devem compartilhar arquivo de
 * Server Action entre si por causa de trabalho paralelo de outro agente.
 * A RLS de `documents` (documents_read) já garante que um responsável só
 * enxerga a linha se shared_with_family=true; o SELECT abaixo é o portão
 * real, o filtro é só defensivo/documentação.
 */
export async function getFamilyDocumentUrl(documentId: string): Promise<UrlResult> {
  if (!documentId) return { success: false, error: "Documento inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, shared_with_family, patients(clinic_id)")
    .eq("id", documentId)
    .eq("shared_with_family", true)
    .maybeSingle();

  if (!doc) {
    return { success: false, error: "Documento não encontrado." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.",
    };
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("clinic-documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed) {
    return { success: false, error: "Não foi possível gerar o link do documento. Tente de novo." };
  }

  // Log de acesso — mesma exigência do PRD §9.5/§11 já aplicada no download
  // pela recepção/prontuário.
  const clinicId = (doc.patients as { clinic_id: string } | null)?.clinic_id ?? null;
  await admin.from("audit_log").insert({
    table_name: "documents",
    row_id: doc.id,
    action: "download",
    actor_id: user.id,
    clinic_id: clinicId,
  });

  return { success: true, url: signed.signedUrl };
}
