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

/** Teto de respostas automáticas por conversa por dia. Um número desconhecido
 * agora dispara o Gemini a cada mensagem; sem isso, um loop ou um contato
 * abusivo viraria custo direto de API. */
const DAILY_REPLY_LIMIT = 20;

const KNOWLEDGE_TTL_MS = 5 * 60 * 1000;

export type FaqEscalationReason = "fora_da_base" | "clinico" | "pediu_humano";

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
  return `Você é a assistente virtual do Instituto Faça Amigos, uma clínica de desenvolvimento infantil multidisciplinar (TEA, fala, questões sensoriais e de aprendizagem). Você conversa por WhatsApp com pais e responsáveis.

${knowledge}

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base nas informações acima. Se a resposta não estiver ali, ou estiver marcada com "⚠️ TODO", NUNCA invente: escale para a equipe humana.
2. Jamais dê diagnóstico, opinião clínica, orientação de saúde ou conduta terapêutica. Qualquer pergunta clínica sobre a criança escala para a equipe.
3. Nunca prometa valor, horário, vaga, cobertura de plano ou prazo que não esteja explícito acima.
4. Seja acolhedora, calorosa e breve — mensagem de WhatsApp, não texto corrido. Use *negrito* do WhatsApp e no máximo um emoji por mensagem.
5. Escreva em português do Brasil, tratando a pessoa por "você".
6. Considere o histórico da conversa: não repita a saudação nem reapresente a clínica se já conversou.
7. Se a pessoa demonstrar interesse em agendar a avaliação, oriente a responder *AGENDAR*.

QUANDO ESCALAR (escalar = true):
- "fora_da_base": a informação pedida não está acima (ou está como ⚠️ TODO).
- "clinico": pergunta sobre sintoma, diagnóstico, evolução ou conduta da criança.
- "pediu_humano": a pessoa pediu para falar com alguém, reclamou ou está claramente insatisfeita.
Ao escalar, o campo "resposta" deve apenas acolher e avisar que a equipe foi chamada — sem tentar responder a dúvida.

Responda SEMPRE em JSON válido, exatamente neste formato:
{"resposta": "texto para enviar no WhatsApp", "escalar": false, "motivo": null, "intent": "planos"}

"motivo" é null quando escalar for false, senão um de: "fora_da_base", "clinico", "pediu_humano".
"intent" é um de: "planos", "valores", "local", "horarios", "terapias", "agendamento", "outro".`;
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

type FaqModelOutput = {
  resposta?: string;
  escalar?: boolean;
  motivo?: string | null;
  intent?: string;
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
async function reserveDailyQuota(phone: string): Promise<boolean> {
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

  if (used >= DAILY_REPLY_LIMIT) return false;

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
}): Promise<FaqBotResult> {
  const { phone, body, conversationId } = params;
  const notHandled: FaqBotResult = { handled: false, replyMessage: "", intent: "", escalated: false };

  if (!body.trim()) return notHandled;
  if (!isGeminiConfigured()) return notHandled;

  const withinQuota = await reserveDailyQuota(phone);
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
    parsed.motivo === "clinico" || parsed.motivo === "pediu_humano" ? parsed.motivo : "fora_da_base";

  if (shouldEscalate && conversationId) {
    await escalateConversation(conversationId, reason);
  }

  return {
    handled: true,
    replyMessage: reply,
    intent: shouldEscalate ? `escalado_${reason}` : `faq_${parsed.intent ?? "outro"}`,
    escalated: shouldEscalate,
  };
}
