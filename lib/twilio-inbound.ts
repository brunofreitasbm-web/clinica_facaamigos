import {
  handleTwilioIncomingMessage,
  sendTwilioWhatsApp,
  sendTwilioSMS,
  formatE164Phone,
  buildMessagePreview,
} from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { closeAttendanceResolvedByBot } from "@/lib/conversation-attendance";

/** Campos do webhook de entrada da Twilio que o processamento usa. É o que vai para a fila. */
export type InboundTwilioPayload = {
  from: string;
  to: string;
  body: string;
  messageSid: string;
  mediaUrl0: string;
  mediaContentType0: string;
  media: { url: string; contentType?: string }[];
};

/**
 * Processa UMA mensagem recebida (bot + registro na inbox + resposta). Extraído
 * de app/api/webhooks/twilio/route.ts para ser chamado tanto pelo webhook quanto
 * pelo reprocessamento da fila (twilio_inbound_queue). Idempotente por
 * MessageSid: handleTwilioIncomingMessage deduplica via messages.twilio_sid.
 */
export async function processInboundTwilioMessage(payload: InboundTwilioPayload): Promise<void> {
  const { from, to, body: bodyText, messageSid, mediaUrl0, mediaContentType0, media } = payload;
    const result = await handleTwilioIncomingMessage({
      from,
      body: bodyText,
      mediaUrl0,
      mediaContentType0,
      media,
      messageSid: messageSid || undefined,
    });

    // Se for mensagem vinda do WhatsApp ou se o número possuir o prefixo 'whatsapp:'
    const isWhatsApp = from.startsWith("whatsapp:") || to.startsWith("whatsapp:");

    // replyMessage vazio (ex.: conversa já assumida por um humano) sinaliza
    // que o bot não deve responder automaticamente.
    if (from && result.replyMessage) {
      const sendResult = isWhatsApp
        ? await sendTwilioWhatsApp({
            to: from.replace("whatsapp:", ""),
            message: result.replyMessage,
          }).catch((err) => {
            console.error("[Twilio Webhook Send Error]:", err);
            return null;
          })
        : await sendTwilioSMS({
            to: from,
            message: result.replyMessage,
          }).catch((err) => {
            console.error("[Twilio Webhook Send Error]:", err);
            return null;
          });

      try {
        const phone = formatE164Phone(from.replace("whatsapp:", ""));
        const supabase = createAdminClient();
        // .limit(1) em vez de .maybeSingle(): uma segunda linha para o
        // mesmo telefone (duplicata histórica) faz .maybeSingle() lançar
        // PGRST116 e o outbound nem é logado — mesmo bug relatado em
        // findOrCreateConversation (lib/twilio.ts), que já usa .limit(1).
        const { data: conversations } = await supabase
          .from("twilio_conversations")
          .select("id, patient_id, guardian_id")
          .eq("phone_number", phone)
          .order("created_at", { ascending: false })
          .limit(1);
        const conversation = conversations?.[0];

        if (conversation) {
          await supabase.from("messages").insert({
            patient_id: conversation.patient_id,
            guardian_id: conversation.guardian_id,
            conversation_id: conversation.id,
            sender_type: "bot",
            channel: "whatsapp",
            direction: "outbound",
            body: result.replyMessage,
            sent_at: new Date().toISOString(),
            twilio_sid: sendResult?.messageId ?? null,
            delivery_status: sendResult?.success ? "sent" : "failed",
            intent: result.intent,
          });

          await supabase
            .from("twilio_conversations")
            .update({ last_message_preview: buildMessagePreview(result.replyMessage) })
            .eq("id", conversation.id);

          // Depois de gravar a resposta: o trigger de `messages` só carimba o
          // atendimento enquanto ele está aberto.
          if (result.concluded) {
            await closeAttendanceResolvedByBot(conversation.id);
          }
        }
      } catch (logErr) {
        console.error("[Twilio Webhook Message Log Error]:", logErr);
      }
    }
}
