import { NextRequest, NextResponse } from "next/server";
import { handleTwilioIncomingMessage, sendTwilioWhatsApp, sendTwilioSMS, formatE164Phone } from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Escape caracteres especiais para segurança no TwiML XML.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  return NextResponse.json({
    status: "Twilio Webhook Ativo",
    service: "Chatbot de Convênios & Atendimento Automatizado",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    let from = "";
    let bodyText = "";
    let to = "";

    let mediaUrl0 = "";
    let mediaContentType0 = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = formData.get("From")?.toString() || "";
      bodyText = formData.get("Body")?.toString() || "";
      to = formData.get("To")?.toString() || "";
      mediaUrl0 = formData.get("MediaUrl0")?.toString() || "";
      mediaContentType0 = formData.get("MediaContentType0")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json();
      from = json.From || json.from || "";
      bodyText = json.Body || json.body || json.message || "";
      to = json.To || json.to || "";
      mediaUrl0 = json.MediaUrl0 || json.mediaUrl0 || "";
      mediaContentType0 = json.MediaContentType0 || json.mediaContentType0 || "";
    } else {
      // Fallback: tentar ler como FormData primeiro, depois como texto se falhar
      try {
        const formData = await req.formData();
        from = formData.get("From")?.toString() || "";
        bodyText = formData.get("Body")?.toString() || "";
        to = formData.get("To")?.toString() || "";
        mediaUrl0 = formData.get("MediaUrl0")?.toString() || "";
        mediaContentType0 = formData.get("MediaContentType0")?.toString() || "";
      } catch {
        const text = await req.text();
        const params = new URLSearchParams(text);
        from = params.get("From") || "";
        bodyText = params.get("Body") || "";
        to = params.get("To") || "";
        mediaUrl0 = params.get("MediaUrl0") || "";
        mediaContentType0 = params.get("MediaContentType0") || "";
      }
    }

    console.log(`[Twilio Webhook Received] From: ${from} | Body: "${bodyText}" | MediaUrl0: "${mediaUrl0}"`);

    const result = await handleTwilioIncomingMessage({
      from,
      body: bodyText,
      mediaUrl0,
      mediaContentType0,
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
        const { data: conversation } = await supabase
          .from("twilio_conversations")
          .select("id, patient_id, guardian_id")
          .eq("phone_number", phone)
          .maybeSingle();

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
          });
        }
      } catch (logErr) {
        console.error("[Twilio Webhook Message Log Error]:", logErr);
      }
    }

    // Gerar resposta em TwiML XML para que a API do Twilio responda instantaneamente de forma nativa.
    // replyMessage vazio (ex.: conversa assumida por humano) não gera <Message>.
    const xmlResponse = result.replyMessage
      ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapeXml(result.replyMessage)}</Message>
</Response>`
      : `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new NextResponse(xmlResponse, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[Twilio Webhook Error]:", error);
    const errMessage = error instanceof Error ? error.message : "Erro interno no webhook Twilio";
    return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
  }
}
