import twilio from "twilio";

import { DEV_CLINIC_ID } from "@/lib/constants";

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
  /**
   * Template aprovado pela Meta (Twilio Content API) — obrigatório fora da
   * janela de 24h de serviço. Quando informado, `contentSid`+
   * `contentVariables` substituem `body` na chamada; `message` continua
   * sendo gravado em `messages.body` pra manter o histórico legível mesmo
   * que o envio real tenha sido via template. Usado pelo bot de acolhimento
   * de plano de saúde (lib/twilio-intake-bot.ts) via
   * TWILIO_INTAKE_TEMPLATE_CONTENT_SID; em sandbox (variável ausente) o
   * envio cai para mensagem livre, igual aos outros bots.
   */
  contentSid?: string;
  contentVariables?: Record<string, string>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: "sms" | "whatsapp";
}

/**
 * Mapeia a categoria do fluxo de comunicação para a variável de ambiente do Content SID correspondente na Twilio/Meta.
 */
export function getTwilioContentSidForCategory(category: string): string | undefined {
  switch (category) {
    case "otp":
      return process.env.TWILIO_OTP_TEMPLATE_CONTENT_SID;
    case "falta":
      return process.env.TWILIO_ABSENCE_TEMPLATE_CONTENT_SID;
    case "pre_anamnese":
      return process.env.TWILIO_ANAMNESIS_TEMPLATE_CONTENT_SID;
    case "triagem_convenio":
      return process.env.TWILIO_INTAKE_TEMPLATE_CONTENT_SID;
    case "nps":
      return process.env.TWILIO_NPS_TEMPLATE_CONTENT_SID;
    case "renovacao_guia":
      return process.env.TWILIO_RENEWAL_TEMPLATE_CONTENT_SID;
    case "cobranca":
      return process.env.TWILIO_BILLING_TEMPLATE_CONTENT_SID;
    default:
      return undefined;
  }
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
      from: fromNumber,
      to: formattedTo,
      mediaUrl: options.mediaUrl,
      ...(options.contentSid
        ? { contentSid: options.contentSid, contentVariables: JSON.stringify(options.contentVariables ?? {}) }
        : { body: options.message }),
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
 * Consulta no banco os convênios cadastrados na clínica e formata a resposta para o WhatsApp/SMS.
 */
export async function getAcceptedInsurersFormatted(clinicId = DEV_CLINIC_ID): Promise<string> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: insurers, error } = await supabase
      .from("insurers")
      .select("id, name, ans_code")
      .eq("clinic_id", clinicId)
      .eq("active", true)
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

export interface FindOrCreateConversationParams {
  phoneNumber: string;
  /** Ausente quando o número ainda não casa com nenhum `guardians.phone` — a
   * conversa nasce como `kind='lead'` para a recepção enxergar quem procurou a
   * clínica (ver migration 20260909100000_twilio_lead_conversations). */
  patientId?: string | null;
  guardianId?: string;
}

/**
 * Busca (ou cria) a conversa (`twilio_conversations`) associada a um número de
 * telefone. Usada tanto pelo webhook de entrada quanto pela Central de
 * Atendimento (`/recepcao/atendimento`) para agrupar as mensagens em threads.
 */
export async function findOrCreateConversation(params: FindOrCreateConversationParams) {
  const { phoneNumber, patientId, guardianId } = params;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: existingRows } = await supabase
    .from("twilio_conversations")
    .select("*")
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: false })
    .limit(1);

  const existing = existingRows?.[0];
  // Lead que virou paciente: promove a thread existente em vez de abrir uma
  // segunda conversa para o mesmo telefone.
  if (existing) {
    if (patientId && !existing.patient_id) {
      const { data: promoted } = await supabase
        .from("twilio_conversations")
        .update({ patient_id: patientId, guardian_id: guardianId ?? null, kind: "patient" })
        .eq("id", existing.id)
        .select("*")
        .single();
      return promoted ?? existing;
    }
    return existing;
  }

  const { data: created, error } = await supabase
    .from("twilio_conversations")
    .insert({
      phone_number: phoneNumber,
      patient_id: patientId ?? null,
      guardian_id: guardianId ?? null,
      clinic_id: DEV_CLINIC_ID,
      kind: patientId ? "patient" : "lead",
    })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Falha ao criar conversa Twilio: ${error?.message ?? "erro desconhecido"}`);
  }

  return created;
}

/**
 * Resolve o paciente (e responsável, quando possível) a partir de um número
 * de telefone — mesma lógica de resolução já usada pela máquina de estados de
 * anamnese (busca em `guardians.phone`).
 */
export async function resolvePatientFromPhone(phone: string): Promise<{ patientId: string; guardianId?: string } | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // `guardians.phone` nem sempre está em E.164 (formulários antigos gravam
  // em formato BR cru) — comparar só pelo E.164 exato perde conversas. Filtra
  // no banco pelos últimos 8 dígitos (bem menos seletivo, mas barato o
  // bastante pro volume desta tabela) e confirma em memória normalizando os
  // dois lados com formatE164Phone, pra não colar números diferentes que só
  // coincidem no sufixo.
  const last8 = phone.replace(/\D/g, "").slice(-8);
  if (last8.length < 8) return null;

  const { data: guardians } = await supabase
    .from("guardians")
    .select("id, patient_id, phone")
    .ilike("phone", `%${last8}`);

  const guardian = (guardians ?? []).find((g) => formatE164Phone(g.phone) === phone);
  if (!guardian) return null;

  return { patientId: guardian.patient_id, guardianId: guardian.id };
}

// Etapas de chatbot_sessions em que outro bot já está esperando um anexo
// (PDF/foto) do telefone — se estiver numa delas, a ingestão de "cadastro
// assistido por IA" (passo 0.7) não deve interceptar a mensagem, senão o
// anexo nunca chega ao fluxo que o pediu. `awaiting_laudo_pdf`/
// `awaiting_guia_pdf` são do bot de anamnese (lib/twilio-anamnesis-bot.ts);
// os steps `intake_*` (bot de acolhimento de plano de saúde,
// lib/twilio-intake-bot.ts) já são tratados antes disso no passo 0.6, mas o
// prefixo entra aqui também como segunda trava, caso a ordem mude no futuro.
const ANAMNESIS_AWAITING_ATTACHMENT_STEPS = ["awaiting_laudo_pdf", "awaiting_guia_pdf"];

async function isAwaitingAnamnesisPdf(phone: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("chatbot_sessions")
      .select("current_step")
      .eq("phone_number", phone)
      .maybeSingle();
    const step = data?.current_step ?? "";
    return Boolean(data && (ANAMNESIS_AWAITING_ATTACHMENT_STEPS.includes(step) || step.startsWith("intake_")));
  } catch {
    return false;
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
  /** Todos os anexos da mensagem (NumMedia/MediaUrl{i}), não só o primeiro —
   * usado pela ingestão de documentos do "cadastro assistido por IA" (ver
   * passo 0.7 abaixo). Opcional: quem chama sem media (ex.: o painel de
   * teste do chatbot) simplesmente não aciona esse fluxo. */
  media?: { url: string; contentType?: string }[];
}): Promise<{ replyMessage: string; intent: string }> {
  const { from, body, mediaUrl0, mediaContentType0, media } = params;
  const phone = formatE164Phone(from.replace("whatsapp:", ""));

  // 0. Central Multicanal: resolve/cria a conversa e, se um humano já assumiu
  // a conversa, não deixa o bot responder. NPS Externo agora é só via portal
  // da família (submit_nps_response), não há mais resposta de NPS por
  // WhatsApp a interceptar aqui.
  //
  // Desde a migration 20260909100000 isto roda para TODO mundo, não só para
  // quem já é paciente: número sem cadastro abre uma conversa `kind='lead'`,
  // que é justamente quem pergunta sobre convênios e valores. Antes essas
  // mensagens não eram persistidas e a recepção nunca via quem procurou a
  // clínica.
  let conversationId: string | null = null;
  let patientId: string | null = null;
  let guardianId: string | null = null;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const resolved = await resolvePatientFromPhone(phone);
    patientId = resolved?.patientId ?? null;
    guardianId = resolved?.guardianId ?? null;
    const conversation = await findOrCreateConversation({
      phoneNumber: phone,
      patientId,
      guardianId: resolved?.guardianId,
    });
    conversationId = conversation.id;

    await supabase
      .from("twilio_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count ?? 0) + 1,
      })
      .eq("id", conversation.id);

    await supabase.from("messages").insert({
      patient_id: resolved?.patientId ?? null,
      guardian_id: resolved?.guardianId ?? null,
      conversation_id: conversation.id,
      sender_type: "user",
      channel: "whatsapp",
      direction: "inbound",
      body,
      media_url: mediaUrl0 || null,
      sent_at: new Date().toISOString(),
    });

    // 0.6 Máquina de estados do bot de ACOLHIMENTO DE PLANO DE SAÚDE
    // (lib/twilio-intake-bot.ts) — roda antes da ingestão genérica de
    // "cadastro assistido por IA" porque os documentos que ele coleta
    // (laudo/guia) têm um destino próprio (insurance_intake_lead_files,
    // vinculados ao lead) e uma resposta guiada (perguntando o que falta,
    // recebendo PRONTO). Roda mesmo com a conversa assumida por um
    // humano, mesma justificativa da ingestão de rascunhos: o documento
    // precisa entrar na fila de qualquer forma.
    try {
      const { processIntakeBotStep } = await import("./twilio-intake-bot");
      const intakeResult = await processIntakeBotStep({ from, body, media });
      if (intakeResult.handled) {
        return { intent: "acolhimento_plano_saude", replyMessage: intakeResult.replyMessage };
      }
    } catch (err) {
      console.error("[Twilio Intake Bot Error]:", err);
    }

    // 0.7 Ingestão de documentos do "cadastro assistido por IA" — roda
    // mesmo que um humano já tenha assumido a conversa (a família pode
    // mandar a carteirinha enquanto fala com a recepção; o item só entra
    // na fila de validação, não substitui a conversa humana). Só desvia
    // se o telefone NÃO estiver numa etapa do bot de anamnese que também
    // consome anexo (awaiting_laudo_pdf/awaiting_guia_pdf/intake_*) —
    // nesse caso o passo acima (ou o passo 1 abaixo) já tratou o anexo.
    if (media && media.length > 0) {
      const isAwaitingAnamnesisAttachment = await isAwaitingAnamnesisPdf(phone);
      if (!isAwaitingAnamnesisAttachment) {
        try {
          const { ingestWhatsappMedia } = await import("./registration-drafts-ingest");
          const ingestResult = await ingestWhatsappMedia({ from, media, body });
          return { intent: "cadastro_documentos", replyMessage: ingestResult.replyMessage };
        } catch (err) {
          console.error("[Twilio Registration Draft Ingest Error]:", err);
        }
      }
    }

    if (!conversation.is_bot_active) {
      return { replyMessage: "", intent: "human_handled" };
    }
  } catch (err) {
    console.error("[Twilio Central Multicanal Error]:", err);
  }

  // 0.4 Tentar processar via Máquina de Estados de Faltas (Remarcação Automática)
  try {
    const { processAbsenceBotStep } = await import("./twilio-absence-bot");
    const sessionRes = await (await import("@/lib/supabase/admin")).createAdminClient().from("chatbot_sessions").select("current_step, collected_data").eq("phone_number", phone).maybeSingle();
    
    if (sessionRes.data && sessionRes.data.current_step?.startsWith("absence_")) {
      const absenceResult = await processAbsenceBotStep(phone, body, sessionRes.data);
      if (absenceResult.handled) {
        return {
          intent: "remarcacao_falta",
          replyMessage: absenceResult.replyMessage,
        };
      }
    }
  } catch (err) {
    console.error("[Twilio Absence Bot Error]:", err);
  }

  // 0.5 Tentar processar via Máquina de Estados do PRÉ-preenchimento de
  // Anamnese assíncrona (disparado no agendamento da avaliação, ver
  // lib/anamnesis-prefill.ts). Roda antes do fluxo de agendamento porque os
  // dois compartilham `chatbot_sessions` por telefone — só um fluxo ativo
  // por vez, e este só "pega" a mensagem se o telefone já estiver numa
  // sessão pre_anamnesis_*.
  try {
    const { processPreAnamnesisStep } = await import("./twilio-preanamnesis-bot");
    const preAnamnesisResult = await processPreAnamnesisStep({ from, body });

    if (preAnamnesisResult.handled) {
      return {
        intent: "pre_anamnese_assincrona",
        replyMessage: preAnamnesisResult.replyMessage,
      };
    }
  } catch (err) {
    console.error("[Twilio Pre-Anamnesis Bot Error]:", err);
  }

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

  // 2. Agente conversacional de FAQ (lib/twilio-faq-bot.ts): responde dúvidas
  // recorrentes (convênios, terapias, valores, endereço) com base na tabela
  // `clinic_faq` e no histórico da thread, e escala para a recepção quando a
  // informação não está na base, o assunto é clínico ou pedem um humano.
  //
  // Substituiu um matcher de palavra-chave + prompt fixo que existiam aqui: o
  // matcher era largo demais (bastava "quais" ou "atende" na frase) e o prompt
  // não recebia histórico, então cada mensagem era tratada isoladamente.
  try {
    const { processFaqBotStep } = await import("./twilio-faq-bot");
    const faqResult = await processFaqBotStep({ phone, body, conversationId, patientId, guardianId });
    if (faqResult.handled) {
      return { intent: faqResult.intent, replyMessage: faqResult.replyMessage };
    }
  } catch (faqErr) {
    console.error("[Twilio FAQ Bot Error]:", faqErr);
  }

  // 3. Resposta padrão amigável (fallback estático — Gemini indisponível,
  // sem chave configurada ou teto diário de respostas atingido)
  return {
    intent: "atendimento_geral",
    replyMessage:
      "Olá! 👋 Agradecemos seu contato com a nossa clínica.\n\n" +
      "• Digite *AGENDAR* para agendar uma Avaliação / Anamnese autorizada pelo seu plano de saúde.\n" +
      "• Pergunte sobre *PLANOS DE SAÚDE* para consultar a lista de convênios aceitos.\n\n" +
      "Como podemos te ajudar hoje?",
  };
}


