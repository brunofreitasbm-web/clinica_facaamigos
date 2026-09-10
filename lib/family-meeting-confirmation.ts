import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp, getTwilioContentSidForCategory, type SendMessageResult } from "@/lib/twilio";
import { CLINIC_TIMEZONE } from "@/lib/constants";

export interface FamilyMeetingNotificationParams {
  patientId: string;
  supervisorId: string;
  date: string;
  time: string;
  /** Quando true, ajusta a mensagem para deixar claro que a data foi alterada (remarcação), não uma marcação nova. */
  isReschedule?: boolean;
}

/** Espelha buildEvaluationConfirmationMessage (lib/evaluation-confirmation.ts), mas pra reunião com responsável de paciente já em acompanhamento — não é uma 1ª avaliação. */
export function buildFamilyMeetingConfirmationMessage(params: {
  patientName: string;
  formattedDate: string;
  supervisorName?: string;
  isReschedule?: boolean;
}): string {
  const supervisorInfo = params.supervisorName ? ` com ${params.supervisorName}` : "";
  const intro = params.isReschedule
    ? `Olá! 💙 A data da reunião${supervisorInfo} sobre o acompanhamento de *${params.patientName}* foi *alterada*. Confira o novo horário abaixo!`
    : `Olá! 💙 Marcamos uma reunião${supervisorInfo} para conversar sobre o acompanhamento de *${params.patientName}*.`;

  return (
    `🗓️ *Reunião ${params.isReschedule ? "Remarcada" : "Agendada"} - FaçaAmigos - Centro de Terapia Comportamental*\n\n` +
    `${intro}\n\n` +
    `📅 *Data e Horário:* ${params.formattedDate}\n\n` +
    `Qualquer dúvida ou imprevisto, é só nos chamar por aqui. Até breve! 🧩✨`
  );
}

/**
 * Envia confirmação via Twilio WhatsApp quando uma reunião com o responsável
 * é marcada pela Supervisão a partir de um chamado na Caixa de entrada (ver
 * bookFamilyMeetingAction em app/supervisao/family-meeting-actions.ts).
 */
export async function sendFamilyMeetingConfirmationNotification(
  params: FamilyMeetingNotificationParams,
): Promise<SendMessageResult | null> {
  try {
    const admin = createAdminClient();

    const [{ data: patient }, { data: guardians }, { data: supervisor }] = await Promise.all([
      admin.from("patients").select("full_name").eq("id", params.patientId).maybeSingle(),
      admin.from("guardians").select("phone, is_financial").eq("patient_id", params.patientId),
      admin.from("profiles").select("full_name").eq("id", params.supervisorId).maybeSingle(),
    ]);

    const patientName = patient?.full_name ?? "Paciente";
    const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
    const formattedPhone = formatE164Phone(guardian?.phone ?? "");
    if (!formattedPhone) {
      console.log("[Twilio Family Meeting Notification] Telefone de contato não encontrado.");
      return null;
    }

    const isoDateTimeStr = `${params.date}T${params.time}:00`;
    const formattedDate = new Date(isoDateTimeStr).toLocaleString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    });

    const message = buildFamilyMeetingConfirmationMessage({
      patientName,
      formattedDate,
      supervisorName: supervisor?.full_name,
      isReschedule: params.isReschedule,
    });

    const contentSid = getTwilioContentSidForCategory("reuniao_responsavel");
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
    console.error("[Twilio Family Meeting Notification Error]:", error);
    return null;
  }
}
