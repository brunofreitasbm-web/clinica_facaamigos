import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp, getTwilioContentSidForCategory, type SendMessageResult } from "@/lib/twilio";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { EvaluationBookInput } from "@/lib/evaluation-agenda";

export interface EvaluationNotificationParams {
  bookInput?: EvaluationBookInput;
  patientId?: string;
  therapistId: string;
  roomId: string;
  date: string;
  time: string;
}

export function buildEvaluationConfirmationMessage(params: {
  patientName: string;
  formattedDate: string;
  therapistName?: string;
  roomName?: string;
}): string {
  const therapistInfo = params.therapistName ? ` com o(a) especialista *${params.therapistName}*` : "";
  const roomInfo = params.roomName ? ` (${params.roomName})` : "";

  return (
    `🗓️ *Confirmação de Agendamento - 1ª Avaliação*\n\n` +
    `Olá! A 1ª Avaliação de *${params.patientName}* foi agendada e confirmada na nossa clínica!\n\n` +
    `📅 *Data e Horário:* ${params.formattedDate}\n` +
    `👤 *Profissional / Sala:*${therapistInfo}${roomInfo}\n\n` +
    `📌 *Orientações importantes para o dia:*\n` +
    `• Chegue com 15 minutos de antecedência na recepção para recepção e conferência de cadastro.\n` +
    `• Traga documento oficial com foto do responsável e da criança/paciente (RG ou Certidão de Nascimento).\n` +
    `• Caso possua laudos anteriores, encaminhamentos médicos ou relatórios de escola/terapias, traga-os impressos.\n` +
    `• Em caso de imprevisto ou dúvidas, entre em contato conosco com antecedência.\n\n` +
    `Estamos prontos para acolher vocês! 💙`
  );
}

/**
 * Envia mensagem automática via Twilio no momento do agendamento da 1ª Avaliação.
 */
export async function sendEvaluationConfirmationNotification(
  params: EvaluationNotificationParams
): Promise<SendMessageResult | null> {
  try {
    const admin = createAdminClient();

    let patientName = "Paciente";
    let phoneToNotify = "";

    // 1. Obter nome do paciente e telefone com base na origem ou patientId
    if (params.patientId) {
      const [{ data: patient }, { data: guardians }] = await Promise.all([
        admin.from("patients").select("full_name").eq("id", params.patientId).maybeSingle(),
        admin.from("guardians").select("phone, is_financial").eq("patient_id", params.patientId),
      ]);
      if (patient?.full_name) patientName = patient.full_name;

      const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
      if (guardian?.phone) {
        phoneToNotify = guardian.phone;
      }
    } else if (params.bookInput) {
      if (params.bookInput.origin === "whatsapp_anamnese") {
        const { data: request } = await admin
          .from("anamnesis_scheduling_requests")
          .select("child_name, guardian_phone")
          .eq("id", params.bookInput.requestId)
          .maybeSingle();

        if (request) {
          if (request.child_name) patientName = request.child_name;
          if (request.guardian_phone) phoneToNotify = request.guardian_phone;
        }
      } else if (params.bookInput.origin === "convenio_pdf") {
        const { data: lead } = await admin
          .from("insurance_intake_leads")
          .select("patient_full_name, phone_e164")
          .eq("id", params.bookInput.leadId)
          .maybeSingle();

        if (lead) {
          if (lead.patient_full_name) patientName = lead.patient_full_name;
          if (lead.phone_e164) phoneToNotify = lead.phone_e164;
        }
      } else if (params.bookInput.origin === "presencial") {
        const [{ data: patient }, { data: guardians }] = await Promise.all([
          admin.from("patients").select("full_name").eq("id", params.bookInput.patientId).maybeSingle(),
          admin.from("guardians").select("phone, is_financial").eq("patient_id", params.bookInput.patientId),
        ]);
        if (patient?.full_name) patientName = patient.full_name;

        const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
        if (guardian?.phone) {
          phoneToNotify = guardian.phone;
        }
      }
    }

    const formattedPhone = formatE164Phone(phoneToNotify);
    if (!formattedPhone) {
      console.log("[Twilio Evaluation Notification] Telefone de contato não encontrado.");
      return null;
    }

    // 2. Buscar detalhes do terapeuta e da sala
    let therapistName = "";
    let roomName = "";

    if (params.therapistId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", params.therapistId)
        .maybeSingle();
      if (profile?.full_name) therapistName = profile.full_name;
    }

    if (params.roomId) {
      const { data: room } = await admin
        .from("rooms")
        .select("name")
        .eq("id", params.roomId)
        .maybeSingle();
      if (room?.name) roomName = room.name;
    }

    // 3. Formatar data/hora
    const isoDateTimeStr = `${params.date}T${params.time}:00`;
    const formattedDate = new Date(isoDateTimeStr).toLocaleString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    });

    // 4. Construir mensagem
    const message = buildEvaluationConfirmationMessage({
      patientName,
      formattedDate,
      therapistName,
      roomName,
    });

    // 5. Disparar via Twilio WhatsApp
    const contentSid = getTwilioContentSidForCategory("confirmacao_d1");
    const result = await sendTwilioWhatsApp({
      to: formattedPhone,
      message,
      ...(contentSid
        ? {
            contentSid,
            contentVariables: {
              "1": "Responsável",
              "2": patientName,
              "3": formattedDate,
              "4": params.time,
              "5": therapistName || "Especialista",
              "6": "Faça Amigos",
            },
          }
        : {}),
    });

    return result;
  } catch (error) {
    console.error("[Twilio Evaluation Notification Error]:", error);
    return null;
  }
}
