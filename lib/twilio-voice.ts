import { formatE164Phone, getTwilioClient, sendTwilioWhatsApp, type SendMessageResult } from "./twilio";

/**
 * Template PT-BR da mensagem de emergência, com placeholders — é o valor
 * gravado em voice_emergency_broadcasts.message_template. Além de avisar a
 * falta do terapeuta, reforça que os demais atendimentos da clínica (outros
 * terapeutas/horários) seguem normalmente, pra família não achar que a
 * clínica inteira parou.
 */
export const EMERGENCY_MESSAGE_TEMPLATE =
  "Olá, aqui é da equipe do FaçaAmigos - Centro de Terapia Comportamental. Informamos que o(a) terapeuta responsável pela sessão do(a) paciente {NOME_PACIENTE}, agendada para hoje às {HORARIO}, está ausente e essa sessão precisará ser reagendada. Os demais atendimentos da clínica seguem normalmente, conforme agendado. Por favor, entre em contato com nossa recepção para reagendar.";

/**
 * Monta a mensagem PT-BR de emergência (usada tanto na fala do TwiML quanto
 * no fallback via WhatsApp), preenchendo o template acima.
 */
export function buildEmergencyMessage(patientName: string, time: string): string {
  return EMERGENCY_MESSAGE_TEMPLATE.replace("{NOME_PACIENTE}", patientName).replace("{HORARIO}", time);
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
 * Fallback quando as tentativas de ligação de voz se esgotam: envia a mesma
 * mensagem de emergência (falta do terapeuta + demais atendimentos mantidos)
 * por WhatsApp.
 */
export async function sendEmergencyFallback(
  options: SendEmergencyFallbackOptions,
): Promise<SendMessageResult> {
  const { to, patientName, time } = options;
  return sendTwilioWhatsApp({
    to,
    message: buildEmergencyMessage(patientName, time),
  });
}
