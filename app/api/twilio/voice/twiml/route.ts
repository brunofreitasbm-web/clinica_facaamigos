import { NextRequest, NextResponse } from "next/server";
import { buildEmergencyMessage } from "@/lib/twilio-voice";

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
function buildTwiml(req: NextRequest): NextResponse {
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
  return buildTwiml(req);
}

export async function POST(req: NextRequest) {
  return buildTwiml(req);
}
