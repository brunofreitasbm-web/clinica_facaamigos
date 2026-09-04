"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };
type UrlResult = { success: true; url: string } | { success: false; error: string };

const SIGNED_URL_TTL_SECONDS = 900;

/**
 * Recepção/supervisão/gestão decide um chamado 'em_analise' (sem anexo e
 * sem categoria 'doenca' — esses dois casos já são auto-aprovados pelo
 * trigger absence_report_apply, 20260904000023). Aprovar aqui aplica a
 * mesma regra manualmente: marca a sessão como falta_familia.
 */
export async function resolveAbsenceReport(
  patientId: string,
  reportId: string,
  decision: "aprovado" | "rejeitado",
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("absence_reports")
    .select("id, appointment_id, status, reason_category")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { success: false, error: "Chamado não encontrado." };
  if (report.status !== "em_analise") {
    return { success: false, error: "Este chamado já foi resolvido." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { error: updateError } = await supabase
    .from("absence_reports")
    .update({ status: decision, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: "Você não tem permissão para decidir este chamado." };
  }

  if (decision === "aprovado") {
    await supabase
      .from("appointments")
      .update({
        status: "falta_familia",
        cancel_reason: report.reason_category,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", report.appointment_id)
      .in("status", ["agendada", "confirmada"]);
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

/**
 * Link assinado do anexo (atestado/comprovante) — mesmo padrão de
 * getDocumentUrl (documents-actions.ts), mas sobre o bucket
 * absence-attachments (isolado de clinic-documents, ver 20260904000023).
 */
export async function getAbsenceAttachmentUrl(reportId: string): Promise<UrlResult> {
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("absence_reports")
    .select("id, attachment_storage_path")
    .eq("id", reportId)
    .maybeSingle();

  if (!report?.attachment_storage_path) {
    return { success: false, error: "Anexo não encontrado." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { success: false, error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico." };
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("absence-attachments")
    .createSignedUrl(report.attachment_storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed) {
    return { success: false, error: "Não foi possível gerar o link do anexo. Tente de novo." };
  }

  return { success: true, url: signed.signedUrl };
}
