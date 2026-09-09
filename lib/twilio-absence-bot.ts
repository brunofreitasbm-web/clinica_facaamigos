import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp, findOrCreateConversation, getTwilioContentSidForCategory } from "@/lib/twilio";
import { computeAvailableSlots } from "@/lib/available-slots";
import { CLINIC_TIMEZONE } from "@/lib/constants";

export async function dispatchAbsenceRescheduleOffer(params: {
  patientId: string;
  guardianId: string;
  phone: string;
  roomId: string;
  therapistId: string;
}): Promise<void> {
  const phoneE164 = formatE164Phone(params.phone);
  if (!phoneE164) return;

  const message = `Olá! Percebemos a ausência do paciente hoje. Esperamos que esteja tudo bem! Por favor, lembre-se de comparecer no próximo dia e horário agendados. Em caso de dúvidas, nossa recepção está à disposição. Um abraço!`;

  // We can skip the template contentSid here since we are just sending a simple welcome message, 
  // or use a generic one if we had it, but plain text works if the window is open.
  // Assuming 24h window is open or this is a free-form message.
  await sendTwilioWhatsApp({
    to: phoneE164,
    message,
  });
}

export async function processAbsenceBotStep(
  phone: string,
  rawBody: string,
  session: any
): Promise<{ handled: boolean; replyMessage: string }> {
  const admin = createAdminClient();
  const data = session.collected_data || {};

  if (session.current_step === "absence_awaiting_slot") {
    const slots = data.slots || [];
    const choiceNum = parseInt(rawBody.trim(), 10);
    const selected = slots[choiceNum - 1];

    if (!selected) {
      return { handled: true, replyMessage: "Opção inválida. Responda com 1, 2 ou 3." };
    }

    // Cria agendamento com status aguardando aprovação
    await admin.from("appointments").insert({
      patient_id: data.patient_id,
      therapist_id: data.therapist_id,
      room_id: data.room_id,
      starts_at: selected.startsAtIso,
      ends_at: selected.endsAtIso,
      status: "aguardando_aprovacao_supervisao", 
      appointment_type_id: "reagendamento"
    });

    await admin.from("chatbot_sessions").update({
      current_step: "idle",
      flow: null,
      collected_data: {},
      updated_at: new Date().toISOString()
    }).eq("phone_number", phone);

    return {
      handled: true,
      replyMessage: "Horário reservado! A supervisão analisará e você receberá a confirmação final em breve."
    };
  }

  return { handled: false, replyMessage: "" };
}
