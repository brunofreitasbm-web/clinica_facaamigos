import twilio from "twilio";

/**
 * Cliente Twilio configurado via variáveis de ambiente.
 * Suporta inicialização com Account SID + Auth Token ou API Key + API Secret.
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
    console.error("[Twilio Init Error]:", error);
    return null;
  }
}

/**
 * Verifica se as credenciais do Twilio estão devidamente configuradas no ambiente.
 */
export function isTwilioConfigured(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET;
  return Boolean(accountSid && authToken && accountSid.length > 5);
}

/**
 * Formata número de telefone para o padrão E.164 (ex: +5511999999999)
 */
export function formatE164Phone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length <= 11) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

export interface SendMessageOptions {
  to: string;
  message: string;
  mediaUrl?: string[];
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: "sms" | "whatsapp";
}

/**
 * Envia mensagem SMS via Twilio
 */
export async function sendTwilioSMS(options: SendMessageOptions): Promise<SendMessageResult> {
  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !isTwilioConfigured()) {
    return {
      success: false,
      channel: "sms",
      error: "Twilio não está configurado no ambiente (.env.local com TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN)",
    };
  }

  if (!fromNumber) {
    return {
      success: false,
      channel: "sms",
      error: "Número remetente (TWILIO_PHONE_NUMBER) não foi informado no .env.local",
    };
  }

  const formattedTo = formatE164Phone(options.to);
  if (!formattedTo) {
    return {
      success: false,
      channel: "sms",
      error: "Número de destino inválido.",
    };
  }

  try {
    const res = await client.messages.create({
      body: options.message,
      from: fromNumber,
      to: formattedTo,
      mediaUrl: options.mediaUrl,
    });

    return {
      success: true,
      channel: "sms",
      messageId: res.sid,
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[Twilio SMS Error]:", errMessage);
    return {
      success: false,
      channel: "sms",
      error: errMessage,
    };
  }
}

/**
 * Envia mensagem via WhatsApp usando o Twilio WhatsApp API / Sandbox
 */
export async function sendTwilioWhatsApp(options: SendMessageOptions): Promise<SendMessageResult> {
  const client = getTwilioClient();
  let fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (!client || !isTwilioConfigured()) {
    return {
      success: false,
      channel: "whatsapp",
      error: "Twilio não está configurado no ambiente (.env.local com TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN)",
    };
  }

  if (!fromNumber) {
    return {
      success: false,
      channel: "whatsapp",
      error: "Número do WhatsApp remetente (TWILIO_WHATSAPP_NUMBER) não foi informado no .env.local",
    };
  }

  // Garantir prefixo 'whatsapp:' no remetente e destinatário
  if (!fromNumber.startsWith("whatsapp:")) {
    const cleanFrom = formatE164Phone(fromNumber);
    fromNumber = `whatsapp:${cleanFrom}`;
  }

  let formattedTo = formatE164Phone(options.to);
  if (!formattedTo) {
    return {
      success: false,
      channel: "whatsapp",
      error: "Número de destino inválido.",
    };
  }
  if (!formattedTo.startsWith("whatsapp:")) {
    formattedTo = `whatsapp:${formattedTo}`;
  }

  try {
    const res = await client.messages.create({
      body: options.message,
      from: fromNumber,
      to: formattedTo,
      mediaUrl: options.mediaUrl,
    });

    return {
      success: true,
      channel: "whatsapp",
      messageId: res.sid,
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[Twilio WhatsApp Error]:", errMessage);
    return {
      success: false,
      channel: "whatsapp",
      error: errMessage,
    };
  }
}
