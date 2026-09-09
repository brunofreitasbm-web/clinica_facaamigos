import twilio from "twilio";
import { formatE164Phone, sendTwilioSMS, type SendMessageResult } from "./twilio";

/**
 * Cliente Twilio configurado via variáveis de ambiente — mesma lógica de
 * inicialização de lib/twilio.ts, replicada aqui pois getTwilioClient não é
 * exportado de lá.
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;

  if (!accountSid || (!authToken && !apiSecret)) {
    return null;
  }

  try {
    if (apiKey && apiSecret && accountSid) {
      return twilio(apiKey, apiSecret, { accountSid });
    }
    return twilio(accountSid, authToken);
  } catch (error) {
    console.error("[Twilio Voice Init Error]:", error);
    return null;
  }
}

/**
 * Template PT-BR da mensagem de emergência, com placeholders — é o valor
 * gravado em voice_emergency_broadcasts.message_template.
 */
export const EMERGENCY_MESSAGE_TEMPLATE =
  "Olá, aqui é da equipe do FaçaAmigos - Centro de Terapia Comportamental. Informamos que a sessão do(a) paciente {NOME_PACIENTE} agendada para hoje às {HORARIO} precisará ser reagendada. Por favor, entre em contato com nossa recepção.";

/**
 * Monta a mensagem PT-BR de emergência (usada tanto na fala do TwiML quanto
 * no fallback via WhatsApp), preenchendo o template acima.
 */
export function buildEmergencyMessage(patientName: string, time: string): string {
  return EMERGENCY_MESSAGE_TEMPLATE.replace("{NOME_PACIENTE}", patientName).replace("{HORARIO}", time);
}

/**
 * Template PT-BR do SMS de fallback — versão enxuta (cabe em 1 segmento de
 * 160 caracteres) usada só quando as tentativas de ligação se esgotam.
 */
export const EMERGENCY_SMS_TEMPLATE =
  "FaçaAmigos: sessão de {NOME_PACIENTE} às {HORARIO} precisa ser remarcada. Fale com a recepção.";

/**
 * Monta o SMS curto de fallback, preenchendo o template acima.
 */
export function buildEmergencySmsMessage(patientName: string, time: string): string {
  return EMERGENCY_SMS_TEMPLATE.replace("{NOME_PACIENTE}", patientName).replace("{HORARIO}", time);
}

export interface CreateEmergencyVoiceCallOptions {
  to: string;
  logId: string;
  patientName: string;
  time: string;
}

export interface VoiceCallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

/**
 * Dispara uma ligação de voz via Twilio para avisar sobre uma emergência
 * (falta de última hora de terapeuta). O TwiML falado é servido por
 * app/api/twilio/voice/twiml/route.ts, e o andamento da chamada é reportado
 * a app/api/twilio/voice/status/route.ts — ambos identificados pelo `logId`
 * (linha em voice_emergency_logs) passado como query string.
 */
export async function createEmergencyVoiceCall(
  options: CreateEmergencyVoiceCallOptions,
): Promise<VoiceCallResult> {
  const { to, logId, patientName, time } = options;

  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_VOICE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  const appUrl = process.env.APP_URL;

  if (!client) {
    return {
      success: false,
      error: "Twilio não está configurado no ambiente (.env.local com TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN)",
    };
  }

  if (!fromNumber) {
    return {
      success: false,
      error: "Número de voz remetente (TWILIO_VOICE_NUMBER ou TWILIO_PHONE_NUMBER) não foi informado no .env.local",
    };
  }

  // APP_URL precisa ser uma URL pública (base do app), pois o Twilio faz
  // requisições HTTP a partir da internet para buscar o TwiML e reportar
  // status — não funciona com localhost.
  if (!appUrl) {
    return {
      success: false,
      error: "APP_URL (URL pública do app) não foi informada no .env.local",
    };
  }

  const formattedTo = formatE164Phone(to);
  if (!formattedTo) {
    return {
      success: false,
      error: "Número de destino inválido.",
    };
  }

  const twimlUrl = `${appUrl}/api/twilio/voice/twiml?logId=${logId}&patientName=${encodeURIComponent(patientName)}&time=${encodeURIComponent(time)}`;
  const statusCallbackUrl = `${appUrl}/api/twilio/voice/status?logId=${logId}&patientName=${encodeURIComponent(patientName)}&time=${encodeURIComponent(time)}`;

  try {
    const call = await client.calls.create({
      to: formattedTo,
      from: fromNumber,
      url: twimlUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    return {
      success: true,
      callSid: call.sid,
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[Twilio Voice Call Error]:", errMessage);
    return {
      success: false,
      error: errMessage,
    };
  }
}

export interface SendEmergencyFallbackOptions {
  to: string;
  patientName: string;
  time: string;
}

/**
 * Fallback quando as tentativas de ligação de voz se esgotam: envia a
 * mensagem curta de emergência por SMS.
 */
export async function sendEmergencyFallback(
  options: SendEmergencyFallbackOptions,
): Promise<SendMessageResult> {
  const { to, patientName, time } = options;
  return sendTwilioSMS({
    to,
    message: buildEmergencySmsMessage(patientName, time),
  });
}
