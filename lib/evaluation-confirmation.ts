import { createAdminClient } from "@/lib/supabase/admin";
import { buildMessagePreview, findOrCreateConversation, formatE164Phone } from "@/lib/twilio";
import { sendWhatsApp, getWhatsAppTemplateForCategory } from "@/lib/whatsapp";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { EvaluationBookInput } from "@/lib/evaluation-agenda";
import { pickEvaluationRecipient } from "@/lib/evaluation-recipient-pure";
import { armPrefillSession, discardPrefillRequest, registerPrefillRequest } from "@/lib/anamnesis-prefill";

/** Resultado do aviso: a supervisão precisa saber quando o responsável NÃO foi avisado. */
export type EvaluationNotificationOutcome =
  /** `bundled`: a mensagem já levou as orientações do dia e o convite da pré-anamnese — o chamador não manda os dois de novo. */
  | { sent: true; bundled?: boolean }
  | { sent: false; reason: string };

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
  /**
   * Manda numa mensagem só a confirmação, as orientações do dia e o convite da
   * pré-anamnese (template `confirmacao_completa`, com botões). Só vale com
   * `patientId` + `appointmentId`, fora de remarcação e com o template
   * configurado; senão a confirmação segue sozinha e o chamador manda o resto.
   */
  bundlePreAnamnesis?: boolean;
}

/** Texto do template único (`confirmacao_completa`): confirmação + orientações + convite. Igual ao corpo aprovado na Meta. */
export function buildEvaluationBundleMessage(params: {
  guardianFirstName: string;
  patientName: string;
  formattedDate: string;
  therapistName: string;
}): string {
  return (
    `Olá, ${params.guardianFirstName}! 💙\n\n` +
    `A 1ª avaliação de ${params.patientName} está confirmada.\n\n` +
    `📅 Data e horário: ${params.formattedDate}\n` +
    `👤 Profissional: ${params.therapistName}\n\n` +
    "Chegue com 15 minutos de antecedência e traga documento com foto do responsável e da criança, além de exames, laudos e relatórios anteriores.\n\n" +
    "Para o terapeuta chegar mais preparado, podemos fazer 5 perguntas rápidas por aqui? As respostas não substituem a avaliação presencial.\n\n" +
    "FaçaAmigos - Centro de Terapia Comportamental"
  );
}

export function buildEvaluationConfirmationMessage(params: {
  patientName: string;
  formattedDate: string;
  therapistName?: string;
  roomName?: string;
  isReschedule?: boolean;
}): string {
  const therapistInfo = params.therapistName ? ` com o(a) especialista *${params.therapistName}*` : "";
  const roomInfo = params.roomName ? ` (${params.roomName})` : "";
  const intro = params.isReschedule
    ? `Olá! 💙 A data da 1ª Avaliação de *${params.patientName}* foi *alterada*. Confira os novos detalhes abaixo!`
    : `Olá! 💙 A 1ª Avaliação de *${params.patientName}* foi agendada e confirmada com muito carinho para a sua família!`;

  return (
    `🗓️ *${params.isReschedule ? "Alteração" : "Confirmação"} de Agendamento - FaçaAmigos - Centro de Terapia Comportamental*\n\n` +
    `${intro}\n\n` +
    `📅 *Data e Horário:* ${params.formattedDate}\n` +
    `👤 *Profissional / Sala:*${therapistInfo}${roomInfo}\n\n` +
    `📌 *Orientações importantes para a família:*\n` +
    `• Chegue com 15 minutos de antecedência para recepção e acolhimento da família.\n` +
    `• Traga documento oficial com foto do responsável e da criança ou adolescente (RG ou Certidão de Nascimento).\n` +
    `• Caso possua laudos anteriores, encaminhamentos médicos ou relatórios escolares/terapêuticos, traga-os impressos.\n` +
    `• Em caso de dúvidas ou imprevistos, nossa equipe está sempre à disposição para ajudar.\n\n` +
    `Estamos ansiosos para acolher vocês e fazer parte desta jornada de desenvolvimento! 🧩✨`
  );
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
    let guardianId: string | null = null;
    let loggedPatientId: string | null = null;

    // 1. Obter nome do paciente e telefone com base na origem ou patientId
    if (params.patientId) {
      const [{ data: patient }, { data: guardians }] = await Promise.all([
        admin.from("patients").select("full_name").eq("id", params.patientId).maybeSingle(),
        admin.from("guardians").select("id, full_name, phone, is_financial").eq("patient_id", params.patientId),
      ]);
      if (patient?.full_name) patientName = patient.full_name;
      loggedPatientId = params.patientId;

      const recipient = pickEvaluationRecipient(guardians ?? []);
      if (recipient) {
        phoneToNotify = recipient.phone;
        guardianFirstName = recipient.firstName;
        guardianId = (guardians ?? []).find((g) => g.phone === recipient.phone)?.id ?? null;
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
      isReschedule: params.isReschedule,
    });

    // Antes nada ficava registrado: falha de envio (ex.: fora da janela de 24h
    // sem template) era invisível pra supervisão e pra Recepção.
    const logOutbound = async (body: string, result: { success: boolean; messageId?: string }) => {
      try {
        const conversation = await findOrCreateConversation({ phoneNumber: formattedPhone, patientId: loggedPatientId });
        await admin.from("messages").insert({
          patient_id: loggedPatientId,
          conversation_id: conversation.id,
          related_appointment_id: params.appointmentId ?? null,
          sender_type: "bot",
          channel: "whatsapp",
          direction: "outbound",
          body,
          sent_at: new Date().toISOString(),
          twilio_sid: result.messageId ?? null,
          delivery_status: result.success ? "sent" : "failed",
        });
        await admin.from("twilio_conversations").update({ last_message_preview: buildMessagePreview(body) }).eq("id", conversation.id);
      } catch (logError) {
        console.error("[Twilio Evaluation Notification] Falha ao registrar mensagem:", logError);
      }
    };

    // 5a. Mensagem única (confirmação + orientações + convite da pré-anamnese): 1 envio no
    // lugar de 3. Qualquer impedimento cai no envio avulso abaixo, que o chamador completa.
    const bundleSid =
      params.bundlePreAnamnesis && !params.isReschedule && params.patientId && params.appointmentId && guardianId
        ? getWhatsAppTemplateForCategory("confirmacao_completa")
        : undefined;
    if (bundleSid && params.patientId && params.appointmentId && guardianId) {
      const registered = await registerPrefillRequest({
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        guardianId,
        phone: formattedPhone,
      });
      if (registered.ok) {
        const therapistLabel = therapistName || "equipe FaçaAmigos";
        const bundleBody = buildEvaluationBundleMessage({
          guardianFirstName: guardianFirstName || "família",
          patientName,
          formattedDate,
          therapistName: therapistLabel,
        });
        const bundled = await sendWhatsApp({
          to: formattedPhone,
          message: bundleBody,
          contentSid: bundleSid,
          // 1 = responsável, 2 = criança, 3 = data e hora, 4 = profissional.
          contentVariables: { "1": guardianFirstName || "família", "2": patientName, "3": formattedDate, "4": therapistLabel },
        });
        await logOutbound(bundleBody, bundled);
        if (bundled.success) {
          await armPrefillSession({ phone: formattedPhone, requestId: registered.requestId, childName: patientName });
          return { sent: true, bundled: true };
        }
        console.error("[Twilio Evaluation Notification] Mensagem única falhou, caindo no envio avulso:", bundled.error);
        await discardPrefillRequest(registered.requestId);
      }
    }

    // 5. Disparar via Twilio WhatsApp
    const contentSid = getWhatsAppTemplateForCategory("confirmacao_d1");
    const result = await sendWhatsApp({
      to: formattedPhone,
      message,
      ...(contentSid
        ? {
            contentSid,
            // Template `confirmacao_avaliacao` (scripts/create-eval-offer-template.ts):
            // 1 = primeiro nome do responsável, 2 = criança, 3 = data e hora, 4 = profissional.
            contentVariables: {
              "1": guardianFirstName || "família",
              "2": patientName,
              "3": formattedDate,
              "4": therapistName || "equipe FaçaAmigos",
            },
          }
        : {}),
    });
    await logOutbound(message, result);

    return result.success ? { sent: true } : { sent: false, reason: result.error ?? "O WhatsApp não aceitou a mensagem." };
  } catch (error) {
    console.error("[Twilio Evaluation Notification Error]:", error);
    return { sent: false, reason: "Erro ao enviar o WhatsApp." };
  }
}
