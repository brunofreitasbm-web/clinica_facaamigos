"use server";

import {
  isTwilioConfigured,
  sendTwilioSMS,
  sendTwilioWhatsApp,
  SendMessageResult,
} from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

export async function checkTwilioStatusAction() {
  const configured = isTwilioConfigured();
  return {
    configured,
    accountSid: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.slice(0, 6)}...` : null,
    hasPhone: Boolean(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER),
  };
}

export async function sendTwilioNotificationAction(params: {
  to: string;
  message: string;
  channel: "sms" | "whatsapp";
  patientId?: string;
  mediaUrl?: string[];
}): Promise<SendMessageResult> {
  const { to, message, channel, patientId, mediaUrl } = params;

  let result: SendMessageResult;
  if (channel === "whatsapp") {
    result = await sendTwilioWhatsApp({ to, message, mediaUrl });
  } else {
    result = await sendTwilioSMS({ to, message, mediaUrl });
  }

  // Tenta registrar auditoria no Supabase caso a tabela exista
  try {
    const supabase = createAdminClient();
    if (supabase) {
      await (supabase.from as any)("notification_logs").insert([
        {
          patient_id: patientId || null,
          recipient_phone: to,
          channel,
          message_body: message,
          status: result.success ? "sent" : "failed",
          twilio_message_sid: result.messageId || null,
          error_message: result.error || null,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  } catch (dbErr) {

    // Ignorar falha de log se a tabela de notificação ainda não estiver criada no Supabase
    console.warn("[Notification Log Insert Skip]:", dbErr);
  }

  return result;
}
