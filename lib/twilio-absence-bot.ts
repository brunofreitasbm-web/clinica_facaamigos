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
  const admin = createAdminClient();
  const phoneE164 = formatE164Phone(params.phone);
  if (!phoneE164) return;

  const slots = await computeAvailableSlots(admin as any, {
    roomId: params.roomId,
    therapistId: params.therapistId,
    durationMinutes: 50,
    limit: 3,
  });

  if (slots.length === 0) {
    console.log("[Absence Bot] Nenhum slot disponível para reagendamento.");
    return;
  }

  const slotOptions = slots.map((s, idx) => `${idx + 1}. ${s.dateLabel} às ${s.timeLabel}`).join("\n");
  const message = `Olá! Notamos a ausência do paciente hoje. Responda com 1, 2 ou 3 para reagendar nos seguintes horários livres:\n${slotOptions}`;

  const contentSid = getTwilioContentSidForCategory("falta");
  const send = await sendTwilioWhatsApp({
    to: phoneE164,
    message,
    ...(contentSid ? { contentSid, contentVariables: { "1": "Responsável", "2": "Paciente", "3": "hoje", "4": "hoje", "5": slotOptions } } : {})
  });

  if (send.success) {
    await admin.from("chatbot_sessions").upsert({
      phone_number: phoneE164,
      current_step: "absence_awaiting_slot",
      flow: "absence",
      collected_data: { patient_id: params.patientId, slots, therapist_id: params.therapistId, room_id: params.roomId },
      updated_at: new Date().toISOString()
    }, { onConflict: "phone_number" });
  }
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
