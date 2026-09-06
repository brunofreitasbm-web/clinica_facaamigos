// app/api/webhooks/twilio/whatsapp/route.ts
/**
 * Webhook de mensagens WhatsApp do Twilio. Substitui o antigo
 * app/api/webhooks/whatsapp/route.ts (stub no formato Meta Cloud API, que
 * não enviava nada de volta e tinha o verify-token hardcoded).
 *
 * Responde via REST (lib/whatsapp/transport.ts), não TwiML — precisamos
 * mandar mais de uma mensagem (ex.: pergunta + list-picker) por turno, o
 * que TwiML não permite numa única resposta simples.
 */
import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "twilio/lib/webhooks/webhooks";
import { getTwilioEnv, getPublicBaseUrl } from "@/lib/whatsapp/env";
import { normalizeBrazilianPhone } from "@/lib/whatsapp-message";
import { ingestInboundMessage } from "@/lib/whatsapp/ingest";

export const dynamic = "force-dynamic";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = req.headers.get("x-twilio-signature");
  let authToken: string;
  try {
    authToken = getTwilioEnv().authToken;
  } catch {
    // Sem credenciais configuradas: em produção isso é um erro de config,
    // mas não vazamos detalhe nenhum pro chamador externo.
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const publicBaseUrl = getPublicBaseUrl();
  const url = `${publicBaseUrl}${req.nextUrl.pathname}`;

  if (!signature || !validateRequest(authToken, signature, url, params)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const from = params.From ?? ""; // "whatsapp:+55..."
  const waId = normalizeBrazilianPhone(params.WaId ?? from.replace("whatsapp:", ""));
  const numMedia = Number(params.NumMedia ?? "0");

  try {
    await ingestInboundMessage({
      waId,
      profileName: params.ProfileName,
      body: params.Body ?? "",
      numMedia,
      mediaUrl0: params.MediaUrl0,
      mediaContentType0: params.MediaContentType0,
      listId: params.ListId,
      buttonPayload: params.ButtonPayload,
      providerSid: params.MessageSid,
    });
  } catch (error) {
    // Erro real de processamento — logamos server-side, mas ainda
    // respondemos 200 pro Twilio não ficar reentregando indefinidamente
    // (o retry de infra do Twilio é por falha de rede/timeout, não por
    // exceção de aplicação).
    console.error("[twilio-whatsapp-webhook] erro ao processar mensagem", error);
  }

  return new NextResponse(EMPTY_TWIML, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  return NextResponse.json({ status: "Webhook Twilio WhatsApp ativo", timestamp: new Date().toISOString() });
}
