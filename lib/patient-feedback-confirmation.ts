import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp, getTwilioContentSidForCategory, type SendMessageResult } from "@/lib/twilio";
import { CLINIC_TIMEZONE } from "@/lib/constants";

export interface PatientFeedbackNotificationParams {
  patientId: string;
  supervisorId: string;
  roomId: string;
  date: string;
  time: string;
  isReschedule?: boolean;
}

/** Espelha buildFamilyMeetingConfirmationMessage (lib/family-meeting-confirmation.ts), mas pra devolutiva do paciente marcada pela Supervisão. */
export function buildPatientFeedbackConfirmationMessage(params: {
  patientName: string;
  formattedDate: string;
  roomName?: string;
  isReschedule?: boolean;
}): string {
  const localInfo = params.roomName ? `\n\n📍 *Local:* ${params.roomName}` : "";
  const intro = params.isReschedule
    ? `Olá! 💙 A data da devolutiva sobre o acompanhamento de *${params.patientName}* foi *alterada*. Confira o novo horário abaixo!`
    : `Olá! 💙 A coordenação da Supervisão precisa conversar com você sobre a devolutiva do acompanhamento de *${params.patientName}*.`;

  return (
    `🗓️ *Devolutiva do Paciente ${params.isReschedule ? "Remarcada" : "Agendada"} - FaçaAmigos - Centro de Terapia Comportamental*\n\n` +
    `${intro}\n\n` +
    `📅 *Data e Horário:* ${params.formattedDate}${localInfo}\n\n` +
    `Qualquer dúvida ou imprevisto, é só nos chamar por aqui. Até breve! 🧩✨`
  );
}

/**
 * Envia confirmação via Twilio WhatsApp quando a Supervisão marca a devolutiva
 * do paciente com os pais (ver bookPatientFeedbackAction em
 * app/supervisao/patient-feedback-actions.ts).
 */
export async function sendPatientFeedbackConfirmationNotification(
  params: PatientFeedbackNotificationParams,
): Promise<SendMessageResult | null> {
  try {
    const admin = createAdminClient();

    const [{ data: patient }, { data: guardians }, { data: room }] = await Promise.all([
      admin.from("patients").select("full_name").eq("id", params.patientId).maybeSingle(),
      admin.from("guardians").select("phone, is_financial").eq("patient_id", params.patientId),
      admin.from("rooms").select("name").eq("id", params.roomId).maybeSingle(),
    ]);

    const patientName = patient?.full_name ?? "Paciente";
    const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
    const formattedPhone = formatE164Phone(guardian?.phone ?? "");
    if (!formattedPhone) {
      console.log("[Twilio Patient Feedback Notification] Telefone de contato não encontrado.");
      return null;
    }

    const isoDateTimeStr = `${params.date}T${params.time}:00`;
    const formattedDate = new Date(isoDateTimeStr).toLocaleString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    });

    const message = buildPatientFeedbackConfirmationMessage({
      patientName,
      formattedDate,
      roomName: room?.name,
      isReschedule: params.isReschedule,
    });

    const contentSid = getTwilioContentSidForCategory("devolutiva_paciente");
    return await sendTwilioWhatsApp({
      to: formattedPhone,
      message,
      ...(contentSid
        ? {
            contentSid,
            contentVariables: {
              "1": "Responsável",
              "2": patientName,
              "3": formattedDate,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("[Twilio Patient Feedback Notification Error]:", error);
    return null;
  }
}
