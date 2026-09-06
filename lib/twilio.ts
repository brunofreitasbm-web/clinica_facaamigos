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

/**
 * Remove acentos e diacríticos de uma string para facilitar busca de palavras-chave.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Verifica se uma mensagem recebida é uma dúvida/pergunta sobre planos de saúde ou convênios.
 */
export function isHealthPlanInquiry(message: string): boolean {
  const norm = normalizeText(message || "");
  if (!norm) return false;

  const keywords = [
    "plano",
    "planos",
    "convenio",
    "convenios",
    "aceita",
    "aceitam",
    "quais",
    "atende",
    "atendem",
    "cobertura",
    "seguro",
    "unimed",
    "bradesco",
    "amil",
    "sulamerica",
    "casssi",
    "geap",
    "postalis",
    "ipam",
    "reembolso",
  ];

  // Se contiver palavras explícitas como "plano", "planos", "convenio", "convenios", ou frases como "aceita..."
  const hasPlanWord = norm.includes("plano") || norm.includes("convenio") || norm.includes("cobertura");
  const hasInquiryWord = norm.includes("quais") || norm.includes("aceita") || norm.includes("atende") || norm.includes("trabalha");

  if (hasPlanWord) return true;
  if (hasInquiryWord && keywords.some((kw) => norm.includes(kw))) return true;

  return false;
}

/**
 * Consulta no banco os convênios cadastrados na clínica e formata a resposta para o WhatsApp/SMS.
 */
export async function getAcceptedInsurersFormatted(clinicId = "c0000000-0000-0000-0000-000000000001"): Promise<string> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: insurers, error } = await supabase
      .from("insurers")
      .select("id, name, ans_code")
      .eq("clinic_id", clinicId)
      .order("name");

    if (error) {
      console.error("[Twilio Chatbot] Erro ao buscar convênios:", error);
    }

    if (!insurers || insurers.length === 0) {
      return (
        "Olá! 👋 Agradecemos seu contato.\n\n" +
        "Atualmente nossos atendimentos são realizados na modalidade *Particular* com emissão de nota fiscal para *Reembolso* junto ao seu plano de saúde.\n\n" +
        "Caso precise de auxílio com a documentação para reembolso ou queira agendar uma avaliação, por favor nos responda por aqui!"
      );
    }

    const planList = insurers
      .map((ins) => `🔹 *${ins.name.trim()}*${ins.ans_code ? ` (ANS: ${ins.ans_code})` : ""}`)
      .join("\n");

    return (
      "Olá! 👋 Sou o assistente virtual da clínica.\n\n" +
      "Atualmente, aceitamos e atendemos os seguintes planos e convênios:\n\n" +
      `${planList}\n\n` +
      "Também emitimos relatórios e notas fiscais para *Reembolso* caso o seu plano não esteja na lista.\n\n" +
      "Como podemos te ajudar com o seu agendamento?"
    );
  } catch (err) {
    console.error("[Twilio Chatbot Exception]:", err);
    return (
      "Olá! 👋 Agradecemos sua mensagem. Nossos atendimentos contemplam convênios parceiros e modalidade particular com reembolso.\n\n" +
      "Um de nossos atendentes responderá em instantes com as informações detalhadas sobre o seu plano!"
    );
  }
}

/**
 * Processa a mensagem recebida e retorna a resposta gerada pelo Chatbot.
 */
export async function handleTwilioIncomingMessage(params: {
  from: string;
  body: string;
  mediaUrl0?: string;
  mediaContentType0?: string;
}): Promise<{ replyMessage: string; intent: string }> {
  const { from, body, mediaUrl0, mediaContentType0 } = params;

  // 1. Tentar processar via Máquina de Estados do Agendamento de Anamnese (WhatsApp)
  try {
    const { processAnamnesisChatbotStep } = await import("./twilio-anamnesis-bot");
    const anamnesisResult = await processAnamnesisChatbotStep({
      from,
      body,
      mediaUrl0,
      mediaContentType0,
    });

    if (anamnesisResult.handled) {
      return {
        intent: "agendamento_anamnese",
        replyMessage: anamnesisResult.replyMessage,
      };
    }
  } catch (err) {
    console.error("[Twilio Anamnesis Bot Error]:", err);
  }

  // 2. Consulta de convênios/planos de saúde aceitos
  if (isHealthPlanInquiry(body)) {
    const replyMessage = await getAcceptedInsurersFormatted();
    return {
      intent: "planos_saude",
      replyMessage,
    };
  }

  // 3. Resposta padrão amigável para outras dúvidas
  return {
    intent: "atendimento_geral",
    replyMessage:
      "Olá! 👋 Agradecemos seu contato com a nossa clínica.\n\n" +
      "• Digite *AGENDAR* para agendar uma Avaliação / Anamnese autorizada pelo seu plano de saúde.\n" +
      "• Pergunte sobre *PLANOS DE SAÚDE* para consultar a lista de convênios aceitos.\n\n" +
      "Como podemos te ajudar hoje?",
  };
}


