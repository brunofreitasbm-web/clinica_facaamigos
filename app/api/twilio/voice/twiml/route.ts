import { NextRequest, NextResponse } from "next/server";
import { buildEmergencyMessage } from "@/lib/twilio-voice";
import { isValidTwilioSignature } from "@/lib/twilio";

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

/**
 * TwiML falado da ligação de emergência (Central de Chamadas de Emergência
 * por Voz — ver createEmergencyVoiceCall em lib/twilio-voice.ts). O Twilio
 * chama esta rota (configurada como `url` da chamada) para buscar o que
 * falar; `logId` identifica a linha em voice_emergency_logs mas não é usado
 * aqui — só serve para correlação em logs, já que não há acesso a banco
 * nesta rota.
 */
async function buildTwiml(req: NextRequest, signatureParams: Record<string, string>): Promise<NextResponse> {
  if (!isValidTwilioSignature(req, signatureParams)) {
    console.error("[Twilio Voice TwiML Signature Error]: assinatura inválida ou ausente — requisição rejeitada.");
    return new NextResponse("Assinatura inválida.", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const patientName = searchParams.get("patientName") ?? "";
  const time = searchParams.get("time") ?? "";

  const message = buildEmergencyMessage(patientName, time);

  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR" voice="Polly.Camila-Neural">${escapeXml(message)}</Say></Response>`;

  return new NextResponse(xmlResponse, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export async function GET(req: NextRequest) {
  // A Twilio assina requisições GET sem corpo — só a URL entra na assinatura.
  return buildTwiml(req, {});
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const signatureParams: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    signatureParams[key] = value.toString();
  }
  return buildTwiml(req, signatureParams);
}
