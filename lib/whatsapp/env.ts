// lib/whatsapp/env.ts
/**
 * Leitura centralizada das env vars do bot — mesmo padrão de
 * lib/anthropic.ts (lança mensagem amigável se faltar), pra nunca espalhar
 * `process.env.X!` pelo código.
 */

export type TwilioEnv = {
  accountSid: string;
  apiKey: string;
  apiSecret: string;
  authToken: string;
  whatsappFrom: string;
};

export function getTwilioEnv(): TwilioEnv {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !apiKey || !apiSecret || !authToken || !whatsappFrom) {
    throw new Error(
      "Credenciais Twilio incompletas — configure TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_FROM.",
    );
  }
  return { accountSid, apiKey, apiSecret, authToken, whatsappFrom };
}

/** 'simulator' (default, sem chamadas externas) ou 'twilio' (produção/sandbox real). */
export function getWhatsappTransportMode(): "simulator" | "twilio" {
  return process.env.WHATSAPP_TRANSPORT === "twilio" ? "twilio" : "simulator";
}

export function getPublicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "";
}

export function getReopenTemplateSid(): string | null {
  return process.env.TWILIO_TEMPLATE_REOPEN_SID ?? null;
}

export function isBotLlmEnabled(): boolean {
  return process.env.BOT_LLM_ENABLED === "true" && !!process.env.GEMINI_API_KEY;
}

export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? null;
}
