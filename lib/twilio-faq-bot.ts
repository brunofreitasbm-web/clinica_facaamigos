/**
 * Agente conversacional de FAQ do WhatsApp (Gemini).
 *
 * Substitui os dois passos finais que existiam soltos em lib/twilio.ts: o
 * matcher de palavra-chave `isHealthPlanInquiry` (largo demais — casava com
 * "quais"/"atende" e engolia "vocês atendem que idade?") e uma chamada ao
 * Gemini com prompt fixo no código e SEM histórico, ou seja, sem memória de
 * conversa.
 *
 * Diferenças relevantes:
 * - o conhecimento vem de `clinic_faq` (editável em /gestor/cadastros/faq),
 *   somado aos convênios e tipos de atendimento reais do banco;
 * - as últimas mensagens da thread vão como `conversationHistory`, então a
 *   pessoa pode perguntar "e o Amazônia cobre fono?" logo depois de "quais
 *   planos vocês atendem?";
 * - o modelo devolve JSON com a decisão de ESCALAR junto da resposta. Quando
 *   a informação não está na base, o assunto é clínico ou pedem um humano, a
 *   conversa vira `status='pending'` com `is_bot_active=false` — o gate de
 *   takeover em lib/twilio.ts cala o bot a partir daí, até a recepção assumir
 *   ou religar o bot pelo toggle da Central.
 *
 * A regra "nunca invente" é o ponto mais importante do prompt: as respostas de
 * endereço, horário e valores nascem com "⚠️ TODO" no seed, então enquanto o
 * gestor não preencher, essas perguntas viram atendimento humano em vez de
 * alucinação sobre preço ou cobertura.
 */

import { DEV_CLINIC_ID } from "@/lib/constants";
import { generateGeminiChatResponse, isGeminiConfigured } from "@/lib/gemini";

/** Quantas mensagens da thread vão como contexto (~6 turnos). */
const HISTORY_LIMIT = 12;

/** Teto de respostas automáticas por conversa por dia, usado se
 * `chatbot_settings.daily_reply_limit` não estiver configurado. Um número
 * desconhecido dispara o Gemini a cada mensagem; sem isso, um loop ou um
 * contato abusivo viraria custo direto de API. */
const DEFAULT_DAILY_REPLY_LIMIT = 20;

const KNOWLEDGE_TTL_MS = 5 * 60 * 1000;
const SETTINGS_TTL_MS = 5 * 60 * 1000;

export type ChatbotSettings = {
  botEnabled: boolean;
  dailyReplyLimit: number;
  greetingFallback: string | null;
};

type SettingsCacheEntry = { settings: ChatbotSettings; expiresAt: number };
const settingsCache = new Map<string, SettingsCacheEntry>();

/**
 * Configurações editáveis em /recepcao/atendimento (aba Chatbot, só
 * Supervisão/Gestão) — `chatbot_settings` tem uma linha por clínica, criada
 * pela migration 20260909200000. Em cache (mesmo TTL do conhecimento de FAQ)
 * porque é lida a cada mensagem recebida no webhook.
 */
export async function getChatbotSettings(clinicId: string): Promise<ChatbotSettings> {
  const cached = settingsCache.get(clinicId);
  if (cached && cached.expiresAt > Date.now()) return cached.settings;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("chatbot_settings")
    .select("bot_enabled, daily_reply_limit, greeting_fallback")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const settings: ChatbotSettings = {
    botEnabled: data?.bot_enabled ?? true,
    dailyReplyLimit: data?.daily_reply_limit ?? DEFAULT_DAILY_REPLY_LIMIT,
    greetingFallback: data?.greeting_fallback ?? null,
  };

  settingsCache.set(clinicId, { settings, expiresAt: Date.now() + SETTINGS_TTL_MS });
  return settings;
}

export type FaqEscalationReason = "fora_da_base" | "clinico" | "pediu_humano" | "relatorio";

export interface FaqBotResult {
  handled: boolean;
  replyMessage: string;
  intent: string;
  escalated: boolean;
}

type KnowledgeCacheEntry = { text: string; expiresAt: number };
const knowledgeCache = new Map<string, KnowledgeCacheEntry>();

/**
 * Monta o bloco de conhecimento do prompt a partir do banco. Em cache por
 * clínica: a base muda raramente e o webhook roda a cada mensagem recebida.
 */
async function buildFaqKnowledge(clinicId: string): Promise<string> {
  const cached = knowledgeCache.get(clinicId);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const [faqRes, insurersRes, typesRes] = await Promise.all([
    supabase
      .from("clinic_faq")
      .select("question, answer, keywords, category")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("insurers").select("name").eq("clinic_id", clinicId).eq("active", true).order("name"),
    supabase
      .from("appointment_types")
      .select("name, duration_minutes")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("name"),
  ]);

  const faqBlock = (faqRes.data ?? [])
    .map((row) => {
      const synonyms = (row.keywords ?? []).length ? ` (também perguntam como: ${(row.keywords ?? []).join(", ")})` : "";
      return `P: ${row.question}${synonyms}\nR: ${row.answer}`;
    })
    .join("\n\n");

  const insurersBlock = (insurersRes.data ?? []).map((i) => i.name.trim()).join(", ");

  const typesBlock = (typesRes.data ?? [])
    .map((t) => `${t.name} (${t.duration_minutes} min)`)
    .join(", ");

  const text = [
    "=== PERGUNTAS FREQUENTES (fonte da verdade) ===",
    faqBlock || "(nenhuma pergunta cadastrada)",
    "",
    "=== CONVÊNIOS ATENDIDOS ===",
    insurersBlock || "(nenhum convênio cadastrado — trate como atendimento particular com reembolso)",
    "",
    "=== TIPOS DE ATENDIMENTO E DURAÇÃO ===",
    typesBlock || "(não cadastrado)",
  ].join("\n");

  knowledgeCache.set(clinicId, { text, expiresAt: Date.now() + KNOWLEDGE_TTL_MS });
  return text;
}

function buildSystemInstruction(knowledge: string): string {
  return `Você é a assistente virtual acolhedora do FaçaAmigos - Centro de Terapia Comportamental, uma clínica multidisciplinar especializada no desenvolvimento de crianças e adolescentes. Você conversa pelo WhatsApp com pais, mães e responsáveis legais.

${knowledge}

REGRAS OBRIGATÓRIAS:
1. MENSAGEM INICIAL DE BOAS-VINDAS: Na primeira interação de saudação, cite obrigatoriamente a marca completa: *FaçaAmigos - Centro de Terapia Comportamental*. Demonstre acolhimento e alegria em receber a família.
2. ATENDIMENTO EMPÁTICO AOS PAIS E RESPONSÁVEIS: Fale diretamente com o pai, mãe ou responsável legal que busca apoio para a criança ou adolescente. Trate a família com profundo carinho, respeito, clareza e acolhimento.
3. EMOJIS ACOLHEDORES: Use emojis integrativos e carinhosos (ex.: 💙, 🧩, 🎈, 🌱, 🤝, ✨) de forma harmoniosa nas mensagens.
4. NUNCA INVENTE: Responda APENAS com base nas informações acima. Se a resposta não estiver ali ou estiver como "⚠️ TODO", NUNCA invente: escale para a equipe humana.
5. ISENÇÃO CLÍNICA: Jamais dê diagnóstico, opinião clínica, orientação médica ou conduta terapêutica. Qualquer pergunta clínica sobre a criança ou adolescente deve ser escalada para a equipe.
6. PRECISÃO: Nunca prometa valores, horários, vagas ou prazos que não estejam explicitamente confirmados acima.
7. HISTÓRICO: Considere o histórico da conversa: não repita a saudação nem reapresente a clínica se já conversou.
8. AGENDAMENTO: Se a pessoa demonstrar interesse em agendar a avaliação, oriente a responder *AGENDAR*.

SOLICITAÇÃO DE RELATÓRIO OU DOCUMENTO (laudo, declaração de comparecimento, relatório de evolução, atestado, etc.):
Isso não é uma dúvida que você responde — é um pedido que a recepção vai atender, mas cabe a você reunir as informações antes de repassar, para a equipe não precisar perguntar tudo de novo.
1. Ao identificar esse pedido, NÃO escale na primeira mensagem. Pergunte em UMA única mensagem organizada (não escale ainda) o que ainda não foi dito no histórico: nome completo da criança/paciente, convênio ou plano de saúde (ou "particular"), qual documento é necessário, e o nome do terapeuta responsável (se a pessoa souber).
2. Se a resposta vier incompleta, pergunte só o que falta — no máximo mais uma vez; não insista além disso.
3. Depois de reunir o que for possível (mesmo incompleto), ESCALE (escalar=true, motivo="relatorio") e no campo "resposta" faça um resumo curto do que foi coletado, para a equipe ler direto sem precisar rolar a conversa. Exemplo: "Perfeito, já anotei! 💛 Vou repassar pra equipe: *Criança:* Maria Silva · *Plano:* Unimed · *Documento:* declaração de comparecimento · *Terapeuta:* Dra. Ana. Só um momento que já te retornam por aqui."
4. Junto com o "escalar=true, motivo=relatorio", preencha TAMBÉM o campo "relatorio_dados" com o que foi coletado (use null no que não foi informado) — é esse campo, não o texto da "resposta", que vira o aviso de pendência para o Supervisor providenciar junto ao terapeuta correspondente.

QUANDO ESCALAR (escalar = true):
- "fora_da_base": a informação pedida não está acima (ou está como ⚠️ TODO).
- "clinico": pergunta sobre sintoma, diagnóstico, evolução ou conduta da criança.
- "pediu_humano": a pessoa pediu para falar com alguém, reclamou ou está claramente insatisfeita.
- "relatorio": pedido de relatório/documento, DEPOIS de reunir os dados acima — nunca na primeira mensagem do pedido.
Ao escalar por "fora_da_base", "clinico" ou "pediu_humano", o campo "resposta" deve apenas acolher e avisar que a equipe foi chamada, sem tentar responder a dúvida. Ao escalar por "relatorio", o campo "resposta" traz o resumo coletado (regra 3 acima) e "relatorio_dados" traz os mesmos dados de forma estruturada.

Responda SEMPRE em JSON válido, exatamente neste formato:
{"resposta": "texto para enviar no WhatsApp", "escalar": false, "motivo": null, "intent": "planos", "relatorio_dados": null}

"motivo" é null quando escalar for false, senão um de: "fora_da_base", "clinico", "pediu_humano", "relatorio".
"intent" é um de: "planos", "valores", "local", "horarios", "terapias", "agendamento", "relatorio", "outro".
"relatorio_dados" é null exceto quando motivo="relatorio", caso em que é um objeto {"crianca": string ou null, "plano": string ou null, "documento": string ou null, "terapeuta": string ou null}.`;
}

/** O Gemini às vezes devolve o JSON embrulhado em cerca de código mesmo em
 * responseMimeType=application/json. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

type ReportRequestData = {
  crianca?: string | null;
  plano?: string | null;
  documento?: string | null;
  terapeuta?: string | null;
};

type FaqModelOutput = {
  resposta?: string;
  escalar?: boolean;
  motivo?: string | null;
  intent?: string;
  relatorio_dados?: ReportRequestData | null;
};

async function loadHistory(conversationId: string): Promise<Array<{ role: "user" | "model"; content: string }>> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("messages")
    .select("body, sender_type, sent_at")
    .eq("conversation_id", conversationId)
    .not("body", "is", null)
    .order("sent_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: (m.sender_type === "user" ? "user" : "model") as "user" | "model",
      content: m.body ?? "",
    }))
    .filter((m) => m.content.trim().length > 0);
}

/**
 * Contabiliza a resposta do dia e diz se o teto já foi atingido. O estado mora
 * em `chatbot_sessions.collected_data` (chaveado por telefone, não exige
 * paciente) para não criar tabela só para isso.
 */
async function reserveDailyQuota(phone: string, dailyReplyLimit: number): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: session } = await supabase
    .from("chatbot_sessions")
    .select("current_step, collected_data")
    .eq("phone_number", phone)
    .maybeSingle();

  const collected = (session?.collected_data ?? {}) as Record<string, unknown>;
  const sameDay = collected.faq_date === today;
  const used = sameDay && typeof collected.faq_count === "number" ? collected.faq_count : 0;

  if (used >= dailyReplyLimit) return false;

  await supabase.from("chatbot_sessions").upsert(
    {
      phone_number: phone,
      current_step: session?.current_step ?? "idle",
      collected_data: { ...collected, faq_date: today, faq_count: used + 1 },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );

  return true;
}

/**
 * Tenta achar o paciente pelo nome que a família deu no WhatsApp. Best-effort:
 * não existe (e não deveria existir) confirmação automática de identidade por
 * nome livre — se der ambíguo ou não achar, a pendência segue sem
 * `patient_id` e quem vê na Central de Atendimento confirma o nome com a
 * família antes de prosseguir.
 */
async function tryResolvePatientByName(clinicId: string, childName: string): Promise<string | null> {
  const name = childName.trim();
  if (name.length < 3) return null;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("full_name", `%${name}%`)
    .limit(2);

  // Mais de um resultado = nome comum demais pra resolver sem ambiguidade;
  // melhor deixar em branco do que arriscar linkar no paciente errado.
  if (!data || data.length !== 1) return null;
  return data[0].id;
}

/**
 * Captura o pedido de relatório/documento e emite o aviso de pendência para o
 * Supervisor providenciar junto ao terapeuta correspondente — mesmo mecanismo
 * já usado pelo botão de PTS em falta (components/prontuario/notify-pts-actions.ts):
 * uma linha em `messages` com `channel='portal'`, que aparece na Caixa de
 * entrada de /supervisao e é resolvida com "Marcar resolvido".
 */
async function notifySupervisorReportRequest(params: {
  conversationId: string | null;
  patientId: string | null;
  guardianId: string | null;
  dados: ReportRequestData;
}): Promise<void> {
  const { conversationId, guardianId, dados } = params;
  let patientId = params.patientId;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    // Idempotência: se já existe um aviso não lido para esta mesma conversa,
    // não duplica (a pessoa pode mandar mais de uma mensagem até o modelo
    // decidir escalar).
    if (conversationId) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("template_key", "relatorio_solicitado")
        .is("read_at", null)
        .maybeSingle();
      if (existing) return;
    }

    if (!patientId && dados.crianca) {
      patientId = await tryResolvePatientByName(DEV_CLINIC_ID, dados.crianca);
    }

    const lines = [
      "📋 [PEDIDO DE RELATÓRIO/DOCUMENTO — via WhatsApp]",
      `Criança/paciente: ${dados.crianca ?? "não informado"}`,
      `Convênio/plano: ${dados.plano ?? "não informado"}`,
      `Documento solicitado: ${dados.documento ?? "não informado"}`,
      `Terapeuta indicado pela família: ${dados.terapeuta ?? "não informado"}`,
      "",
      patientId
        ? "Cadastro localizado automaticamente pelo nome informado — confira antes de prosseguir."
        : "⚠️ Não foi possível localizar o cadastro automaticamente pelo nome informado — confirme com a família antes de providenciar.",
      "Providencie junto ao terapeuta responsável e retorne a família pelo WhatsApp (Central de Atendimento).",
    ];

    await supabase.from("messages").insert({
      patient_id: patientId,
      guardian_id: guardianId,
      conversation_id: conversationId,
      channel: "portal",
      direction: "inbound",
      template_key: "relatorio_solicitado",
      body: lines.join("\n"),
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Twilio FAQ Bot] Falha ao notificar supervisor sobre pedido de relatório:", err);
  }
}

async function escalateConversation(conversationId: string, reason: FaqEscalationReason) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  await supabase
    .from("twilio_conversations")
    .update({
      is_bot_active: false,
      status: "pending",
      escalation_reason: reason,
    })
    .eq("id", conversationId);
}

export async function processFaqBotStep(params: {
  phone: string;
  body: string;
  conversationId: string | null;
  patientId?: string | null;
  guardianId?: string | null;
}): Promise<FaqBotResult> {
  const { phone, body, conversationId, patientId = null, guardianId = null } = params;
  const notHandled: FaqBotResult = { handled: false, replyMessage: "", intent: "", escalated: false };

  if (!body.trim()) return notHandled;
  if (!isGeminiConfigured()) return notHandled;

  const settings = await getChatbotSettings(DEV_CLINIC_ID);
  const withinQuota = await reserveDailyQuota(phone, settings.dailyReplyLimit);
  if (!withinQuota) return notHandled;

  const knowledge = await buildFaqKnowledge(DEV_CLINIC_ID);
  const conversationHistory = conversationId ? await loadHistory(conversationId) : [];

  const aiResponse = await generateGeminiChatResponse({
    prompt: body,
    systemInstruction: buildSystemInstruction(knowledge),
    conversationHistory,
    temperature: 0.4,
    jsonMode: true,
  });

  if (!aiResponse.success || !aiResponse.text) return notHandled;

  let parsed: FaqModelOutput;
  try {
    parsed = JSON.parse(stripCodeFence(aiResponse.text)) as FaqModelOutput;
  } catch {
    console.error("[Twilio FAQ Bot] JSON inválido do Gemini:", aiResponse.text.slice(0, 200));
    return notHandled;
  }

  const reply = (parsed.resposta ?? "").trim();
  if (!reply) return notHandled;

  const shouldEscalate = parsed.escalar === true;
  const reason: FaqEscalationReason =
    parsed.motivo === "clinico" || parsed.motivo === "pediu_humano" || parsed.motivo === "relatorio"
      ? parsed.motivo
      : "fora_da_base";

  if (shouldEscalate && conversationId) {
    await escalateConversation(conversationId, reason);
  }

  if (shouldEscalate && reason === "relatorio") {
    await notifySupervisorReportRequest({
      conversationId,
      patientId,
      guardianId,
      dados: parsed.relatorio_dados ?? {},
    });
  }

  return {
    handled: true,
    replyMessage: reply,
    intent: shouldEscalate ? `escalado_${reason}` : `faq_${parsed.intent ?? "outro"}`,
    escalated: shouldEscalate,
  };
}
