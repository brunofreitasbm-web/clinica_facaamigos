import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { handleTwilioIncomingMessage, sendTwilioWhatsApp, sendTwilioSMS, formatE164Phone } from "@/lib/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;

/**
 * Confere a assinatura X-Twilio-Signature contra o Auth Token da conta —
 * sem isso qualquer pessoa pode POSTar neste endpoint se passando pelo
 * Twilio (nenhuma rota deste projeto validava isso). `TWILIO_WEBHOOK_URL`
 * cobre o caso comum de dev atrás de proxy/túnel (ngrok etc.), onde a URL
 * pública configurada no console Twilio difere de `req.url`; em produção,
 * deixe a variável vazia e a própria URL da requisição é usada.
 * `TWILIO_SKIP_SIGNATURE_VALIDATION=true` existe só para dev local sem
 * túnel (o Twilio nunca alcança localhost pra assinar de verdade).
 */
function isValidTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  if (process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true") return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers.get("x-twilio-signature");
  if (!authToken || !signature) return false;

  const publicUrl = process.env.TWILIO_WEBHOOK_URL || req.url;
  return twilio.validateRequest(authToken, signature, publicUrl, params);
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
    // NumMedia + MediaUrl{i}/MediaContentType{i}: Twilio manda o total de
    // anexos da mensagem (o WhatsApp normalmente entrega 1 por mensagem, mas
    // o formato suporta mais). Usado pelo fluxo de "cadastro assistido por
    // IA" (lib/registration-drafts-ingest.ts) — mediaUrl0/mediaContentType0
    // continuam existindo à parte pra não quebrar o bot de anamnese, que só
    // olha o primeiro anexo.
    let media: { url: string; contentType?: string }[] = [];

    function collectMedia(get: (key: string) => string | null): { url: string; contentType?: string }[] {
      const numMedia = Number(get("NumMedia") ?? "0") || 0;
      const items: { url: string; contentType?: string }[] = [];
      for (let i = 0; i < numMedia; i++) {
        const url = get(`MediaUrl${i}`);
        if (url) items.push({ url, contentType: get(`MediaContentType${i}`) ?? undefined });
      }
      return items;
    }

    const contentType = req.headers.get("content-type") || "";
    // Parâmetros crus pra validação de assinatura — twilio.validateRequest
    // exige o dicionário exato que o Twilio assinou. Só o POST
    // form-urlencoded é o formato real que o Twilio envia; os outros ramos
    // existem para depuração manual (curl/Postman) e nunca chegam assinados.
    let signatureParams: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = formData.get("From")?.toString() || "";
      bodyText = formData.get("Body")?.toString() || "";
      to = formData.get("To")?.toString() || "";
      mediaUrl0 = formData.get("MediaUrl0")?.toString() || "";
      mediaContentType0 = formData.get("MediaContentType0")?.toString() || "";
      media = collectMedia((key) => formData.get(key)?.toString() ?? null);
      for (const [key, value] of formData.entries()) {
        signatureParams[key] = value.toString();
      }
    } else if (contentType.includes("application/json")) {
      const json = await req.json();
      from = json.From || json.from || "";
      bodyText = json.Body || json.body || json.message || "";
      to = json.To || json.to || "";
      mediaUrl0 = json.MediaUrl0 || json.mediaUrl0 || "";
      mediaContentType0 = json.MediaContentType0 || json.mediaContentType0 || "";
      media = collectMedia((key) => (json[key] ?? null) as string | null);
    } else {
      // Fallback: tentar ler como FormData primeiro, depois como texto se falhar
      try {
        const formData = await req.formData();
        from = formData.get("From")?.toString() || "";
        bodyText = formData.get("Body")?.toString() || "";
        to = formData.get("To")?.toString() || "";
        mediaUrl0 = formData.get("MediaUrl0")?.toString() || "";
        mediaContentType0 = formData.get("MediaContentType0")?.toString() || "";
        media = collectMedia((key) => formData.get(key)?.toString() ?? null);
        for (const [key, value] of formData.entries()) {
          signatureParams[key] = value.toString();
        }
      } catch {
        const text = await req.text();
        const params = new URLSearchParams(text);
        from = params.get("From") || "";
        bodyText = params.get("Body") || "";
        to = params.get("To") || "";
        mediaUrl0 = params.get("MediaUrl0") || "";
        mediaContentType0 = params.get("MediaContentType0") || "";
        media = collectMedia((key) => params.get(key));
        signatureParams = Object.fromEntries(params.entries());
      }
    }

    if (!isValidTwilioSignature(req, signatureParams)) {
      console.error(
        "[Twilio Webhook Signature Error]: assinatura inválida ou ausente — requisição rejeitada.",
        JSON.stringify({
          reqUrl: req.url,
          host: req.headers.get("host"),
          xForwardedHost: req.headers.get("x-forwarded-host"),
          xForwardedProto: req.headers.get("x-forwarded-proto"),
          hasSignature: !!req.headers.get("x-twilio-signature"),
          contentType,
          signatureParams,
          receivedSignature: req.headers.get("x-twilio-signature"),
          authTokenFingerprint: process.env.TWILIO_AUTH_TOKEN
            ? `${process.env.TWILIO_AUTH_TOKEN.slice(0, 4)}...${process.env.TWILIO_AUTH_TOKEN.slice(-4)} (len=${process.env.TWILIO_AUTH_TOKEN.length})`
            : "MISSING",
        }),
      );
      return NextResponse.json({ success: false, error: "Assinatura inválida." }, { status: 403 });
    }

    console.log(`[Twilio Webhook Received] From: ${from} | Body: "${bodyText}" | MediaUrl0: "${mediaUrl0}"`);

    const result = await handleTwilioIncomingMessage({
      from,
      body: bodyText,
      mediaUrl0,
      mediaContentType0,
      media,
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
        }
      } catch (logErr) {
        console.error("[Twilio Webhook Message Log Error]:", logErr);
      }
    }

    // Sempre devolve TwiML vazio: a resposta já foi enviada acima via REST
    // (client.messages.create), que é o único jeito de capturar o `sid` e
    // logar o outbound em `messages`/`twilio_conversations`. Devolver
    // também um <Message> aqui fazia o Twilio entregar a mesma resposta
    // DUAS VEZES para a família — bug corrigido nesta entrega.
    return new NextResponse(EMPTY_TWIML, {
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
