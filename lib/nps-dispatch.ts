import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioContentSidForCategory, sendTwilioWhatsApp } from "@/lib/twilio";
import { buildAnamneseNpsPayload } from "./nps-dispatch-pure";

export { buildAnamneseNpsPayload };

export interface DispatchAnamneseNpsResult {
  success: boolean;
  surveyId?: string;
  messageId?: string;
  reason?: string;
}

/**
 * Dispara a pesquisa NPS (via Twilio WhatsApp) para o responsável do paciente
 * após a conclusão da Anamnese / 1ª Avaliação.
 */
export async function dispatchAnamneseNps(
  patientId: string,
  appointmentId?: string
): Promise<DispatchAnamneseNpsResult> {
  const admin = createAdminClient();

  // 1. Busca os responsáveis do paciente (preferindo o financeiro/principal)
  const { data: guardians, error: guardianErr } = await admin
    .from("guardians")
    .select("id, full_name, phone, is_financial")
    .eq("patient_id", patientId);

  if (guardianErr || !guardians || guardians.length === 0) {
    return { success: false, reason: "no_guardian_found" };
  }

  const guardian = guardians.find((g) => g.is_financial) ?? guardians[0];
  if (!guardian || !guardian.phone) {
    return { success: false, reason: "no_guardian_phone" };
  }

  // 2. Se não foi passado appointmentId, tenta encontrar um agendamento de avaliação recente
  let targetAppointmentId = appointmentId;
  if (!targetAppointmentId) {
    const { data: appt } = await admin
      .from("appointments")
      .select("id")
      .eq("patient_id", patientId)
      .eq("is_evaluation", true)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appt?.id) {
      targetAppointmentId = appt.id;
    }
  }

  // 3. Verifica se já existe um disparo de NPS de avaliação para este appointment/paciente
  let alreadyExists = false;
  if (targetAppointmentId) {
    const { data: existingAppt } = await admin
      .from("nps_surveys")
      .select("id")
      .eq("appointment_id", targetAppointmentId)
      .maybeSingle();
    if (existingAppt) alreadyExists = true;
  }

  if (!alreadyExists) {
    const { data: existingPatientEval } = await admin
      .from("nps_surveys")
      .select("id")
      .eq("patient_id", patientId)
      .eq("trigger_type", "evaluation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPatientEval) {
      alreadyExists = true;
    }
  }

  if (alreadyExists) {
    return { success: false, reason: "already_dispatched" };
  }

  // 4. Cria o registro pendente em nps_surveys
  const { data: survey, error: insertErr } = await admin
    .from("nps_surveys")
    .insert({
      patient_id: patientId,
      guardian_id: guardian.id,
      phone_number: guardian.phone,
      trigger_type: "evaluation",
      appointment_id: targetAppointmentId ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !survey) {
    console.error("[NPS Anamnese Dispatch Insert Error]:", insertErr);
    return { success: false, reason: insertErr?.message || "insert_failed" };
  }

  // 5. Envia mensagem via WhatsApp usando Twilio
  const { data: patient } = await admin
    .from("patients")
    .select("full_name")
    .eq("id", patientId)
    .single();

  const payload = buildAnamneseNpsPayload(guardian.full_name, patient?.full_name);
  const contentSid = getTwilioContentSidForCategory("nps");

  const sendResult = await sendTwilioWhatsApp({
    to: guardian.phone,
    message: payload.messageText,
    ...(contentSid
      ? {
          contentSid,
          contentVariables: {
            "1": payload.guardianFirstName,
            "2": payload.patientFirstName,
            "3": "FaçaAmigos",
            "4": payload.surveyUrl,
          },
        }
      : {}),
  });

  return {
    success: sendResult.success,
    surveyId: survey.id,
    messageId: sendResult.messageId,
    reason: sendResult.error,
  };
}
