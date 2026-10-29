import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone } from "@/lib/twilio";
import { sendWhatsApp, getWhatsAppTemplateForCategory } from "@/lib/whatsapp";
import { buildEvaluationGuidanceMessage } from "@/lib/evaluation-guidance-pure";

/**
 * Orientações do dia da 1ª avaliação (chegar 15 min antes, trazer exames/laudos).
 * Vai logo depois da confirmação do horário e antes do convite da pré-anamnese.
 * Com o template (`orientacoes_avaliacao`) aprovado a mensagem entrega mesmo com a
 * janela de 24h fechada; sem ele cai no texto livre. Nunca lança: é um reforço, a
 * avaliação já está agendada.
 */
export async function sendEvaluationGuidanceNotification(patientId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ data: patient }, { data: guardians }] = await Promise.all([
      admin.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
      admin.from("guardians").select("phone, is_financial").eq("patient_id", patientId),
    ]);
    const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
    const phone = formatE164Phone(guardian?.phone ?? "");
    if (!phone) return;

    const childName = patient?.full_name ?? "seu(sua) filho(a)";
    const contentSid = getWhatsAppTemplateForCategory("orientacoes_avaliacao");
    const result = await sendWhatsApp({
      to: phone,
      message: buildEvaluationGuidanceMessage(childName),
      ...(contentSid ? { contentSid, contentVariables: { "1": childName } } : {}),
    });
    if (!result.success) console.error("[Evaluation Guidance] Falha ao enviar:", result.error);
  } catch (err) {
    console.error("[Evaluation Guidance] Exceção:", err);
  }
}
