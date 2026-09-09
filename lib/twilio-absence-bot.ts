import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp } from "@/lib/twilio";

export async function dispatchAbsenceRescheduleOffer(params: {
  patientId: string;
  guardianId: string;
  phone: string;
  roomId?: string;
  therapistId?: string;
}): Promise<void> {
  const phoneE164 = formatE164Phone(params.phone);
  if (!phoneE164) return;

  const admin = createAdminClient();
  const { data: patient } = await admin
    .from("patients")
    .select("full_name")
    .eq("id", params.patientId)
    .maybeSingle();

  const rawName = patient?.full_name?.trim();
  const childName = rawName ? rawName.split(" ")[0] : "a criança";

  const message = `Infelizmente a clínica sente a ausência de ${childName}. Aguardamos vocês na próxima sessão agendada!`;

  await sendTwilioWhatsApp({
    to: phoneE164,
    message,
  });
}

export async function processAbsenceBotStep(
  phone: string,
  _rawBody: string,
  session: any
): Promise<{ handled: boolean; replyMessage: string }> {
  if (session.current_step?.startsWith("absence_")) {
    const admin = createAdminClient();
    await admin.from("chatbot_sessions").update({
      current_step: "idle",
      flow: null,
      collected_data: {},
      updated_at: new Date().toISOString()
    }).eq("phone_number", phone);

    return {
      handled: true,
      replyMessage: "Recebemos sua mensagem. Como a política da clínica não prevê reagendamento de faltas, aguardamos vocês na próxima sessão agendada!"
    };
  }

  return { handled: false, replyMessage: "" };
}

