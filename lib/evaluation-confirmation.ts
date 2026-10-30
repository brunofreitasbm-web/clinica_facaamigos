import { createAdminClient } from "@/lib/supabase/admin";
import { buildMessagePreview, findOrCreateConversation, formatE164Phone } from "@/lib/twilio";
import { sendWhatsApp, getWhatsAppTemplateForCategory } from "@/lib/whatsapp";
import type { EvaluationBookInput } from "@/lib/evaluation-agenda";
import {
  buildEvaluationConfirmationMessage,
  buildEvaluationRescheduleMessage,
  formatEvaluationDateShort,
} from "@/lib/evaluation-confirmation-pure";
import { pickEvaluationRecipient } from "@/lib/evaluation-recipient-pure";

/** Resultado do aviso: a supervisão precisa saber quando o responsável NÃO foi avisado. */
export type EvaluationNotificationOutcome = { sent: true } | { sent: false; reason: string };

export interface EvaluationNotificationParams {
  bookInput?: EvaluationBookInput;
  patientId?: string;
  therapistId: string;
  roomId: string;
  date: string;
  time: string;
  /** Quando true, ajusta a mensagem para deixar claro que a data foi alterada (remarcação), não uma 1ª marcação. */
  isReschedule?: boolean;
  /** Vincula a mensagem registrada em `messages` ao agendamento. */
  appointmentId?: string;
}

/**
 * Envia mensagem automática via Twilio no momento do agendamento da 1ª Avaliação.
 */
export async function sendEvaluationConfirmationNotification(
  params: EvaluationNotificationParams
): Promise<EvaluationNotificationOutcome> {
  try {
    const admin = createAdminClient();

    let patientName = "Paciente";
    let phoneToNotify = "";
    let guardianFirstName = "";
    let loggedPatientId: string | null = null;

    // 1. Obter nome do paciente e telefone com base na origem ou patientId
    if (params.patientId) {
      const [{ data: patient }, { data: guardians }] = await Promise.all([
        admin.from("patients").select("full_name").eq("id", params.patientId).maybeSingle(),
        admin.from("guardians").select("full_name, phone, is_financial").eq("patient_id", params.patientId),
      ]);
      if (patient?.full_name) patientName = patient.full_name;
      loggedPatientId = params.patientId;

      const recipient = pickEvaluationRecipient(guardians ?? []);
      if (recipient) {
        phoneToNotify = recipient.phone;
        guardianFirstName = recipient.firstName;
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
          admin.from("guardians").select("full_name, phone, is_financial").eq("patient_id", params.bookInput.patientId),
        ]);
        if (patient?.full_name) patientName = patient.full_name;
        loggedPatientId = params.bookInput.patientId;

        const recipient = pickEvaluationRecipient(guardians ?? []);
        if (recipient) {
          phoneToNotify = recipient.phone;
          guardianFirstName = recipient.firstName;
        }
      }
    }

    // Fallback: se não encontrou nos guardians, busca pelo telefone registrado na oferta da 1ª avaliação
    if (!phoneToNotify && (params.appointmentId || params.patientId)) {
      const looseAdmin = admin as unknown as { from: (table: string) => any };
      let offerQuery = looseAdmin.from("evaluation_offers").select("phone_e164");
      if (params.appointmentId) {
        offerQuery = offerQuery.eq("appointment_id", params.appointmentId);
      } else if (params.patientId) {
        offerQuery = offerQuery.eq("patient_id", params.patientId);
      }
      const { data: offer } = await offerQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (offer?.phone_e164 && offer.phone_e164 !== "-") {
        phoneToNotify = offer.phone_e164;
        if (!guardianFirstName) guardianFirstName = "família";
      }
    }

    const formattedPhone = formatE164Phone(phoneToNotify);
    if (!formattedPhone) {
      console.log("[Twilio Evaluation Notification] Telefone de contato não encontrado.");
      return { sent: false, reason: "Sem telefone do responsável cadastrado." };
    }

    // 2. Buscar detalhes do terapeuta e da sala
    let therapistName = "";

    if (params.therapistId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", params.therapistId)
        .maybeSingle();
      if (profile?.full_name) therapistName = profile.full_name;
    }

    // 3. Data/hora curta ("sex, 30/10 às 14h30"); `date`/`time` já estão no fuso da clínica.
    const formattedDate = formatEvaluationDateShort(params.date, params.time);

    // 4. Construir mensagem (única: confirmação + orientações do dia)
    const messageParams = {
      guardianFirstName: guardianFirstName || "família",
      patientName,
      formattedDate,
      therapistName: therapistName || "equipe FaçaAmigos",
    };
    const message = params.isReschedule
      ? buildEvaluationRescheduleMessage(messageParams)
      : buildEvaluationConfirmationMessage(messageParams);

    // 5. Disparar via Twilio WhatsApp. Remarcação vai em texto livre: o template diz "confirmado".
    const contentSid = params.isReschedule ? undefined : getWhatsAppTemplateForCategory("confirmacao_d1");
    const result = await sendWhatsApp({
      to: formattedPhone,
      message,
      ...(contentSid
        ? {
            contentSid,
            // Template `fa_clinica_avaliacao_confirmada_v2` (scripts/create-eval-offer-template.ts):
            // 1 = primeiro nome do responsável, 2 = criança, 3 = data curta, 4 = profissional.
            contentVariables: {
              "1": messageParams.guardianFirstName,
              "2": patientName,
              "3": formattedDate,
              "4": messageParams.therapistName,
            },
          }
        : {}),
    });

    // Antes nada ficava registrado: falha de envio (ex.: fora da janela de 24h
    // sem template) era invisível pra supervisão e pra Recepção.
    try {
      const conversation = await findOrCreateConversation({ phoneNumber: formattedPhone, patientId: loggedPatientId });
      await admin.from("messages").insert({
        patient_id: loggedPatientId,
        conversation_id: conversation.id,
        related_appointment_id: params.appointmentId ?? null,
        sender_type: "bot",
        channel: "whatsapp",
        direction: "outbound",
        body: message,
        sent_at: new Date().toISOString(),
        twilio_sid: result.messageId ?? null,
        delivery_status: result.success ? "sent" : "failed",
      });
      await admin.from("twilio_conversations").update({ last_message_preview: buildMessagePreview(message) }).eq("id", conversation.id);
    } catch (logError) {
      console.error("[Twilio Evaluation Notification] Falha ao registrar mensagem:", logError);
    }

    return result.success ? { sent: true } : { sent: false, reason: result.error ?? "O WhatsApp não aceitou a mensagem." };
  } catch (error) {
    console.error("[Twilio Evaluation Notification Error]:", error);
    return { sent: false, reason: "Erro ao enviar o WhatsApp." };
  }
}
