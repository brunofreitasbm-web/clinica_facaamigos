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
 * - o conhecimento vem de `clinic_faq` (editável na aba Chatbot de
 *   /recepcao/atendimento, restrita a supervisor/gestor), somado aos
 *   convênios e tipos de atendimento reais do banco;
 * - as últimas mensagens da thread vão como `conversationHistory`, então a
 *   pessoa pode perguntar "e o Amazônia cobre fono?" logo depois de "quais
 *   planos vocês atendem?";
 * - o modelo devolve JSON com a decisão de ESCALAR junto da resposta. Quando
 *   a informação não está na base, o assunto é clínico ou pedem um humano, a
 *   conversa vira `status='pending'` com `is_bot_active=false` — o gate de
 *   takeover em lib/twilio.ts cala o bot a partir daí, até a recepção assumir
 *   ou religar o bot pelo toggle da Central.
 *
 * Currículo/vaga de EMPREGO (não confundir com vaga na agenda — a
 * desambiguação está em lib/job-inquiry-pure.ts) é o único assunto com saída
 * própria: o bot manda
 * a mensagem do "Trabalhe Conosco" do site e DESLIGA o atendimento automático
 * da conversa (`is_bot_active=false`, `status='closed'`) sem escalar — não é
 * caso de recepção, e nenhuma mensagem seguinte desse contato é respondida.
 *
 * A regra "nunca invente" é o ponto mais importante do prompt: perguntas sem
 * resposta na base (endereço, horário etc., enquanto o gestor não preencher)
 * viram atendimento humano em vez de alucinação. Valor particular é exceção
 * deliberada — vem da tabela de preços do convênio "Particular"
 * (`insurer_price_tables`) e PODE ser informado direto pelo bot; valor de
 * convênio nunca é exposto (não entra na base de conhecimento).
 */

import { DEV_CLINIC_ID } from "@/lib/constants";
import { formatBusinessHours } from "@/lib/business-hours-pure";
import { hasExplicitJobSignal, hasStrongJobSignal, JOB_INQUIRY_REPLY } from "@/lib/job-inquiry-pure";
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

/** O atendimento particular é cadastrado como um convênio sem guia; é a
 * tabela de preços DELE que o bot pode divulgar. */
const PARTICULAR_INSURER_NAME = "particular";

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
  /** O bot deu a resposta definitiva e a pessoa não precisa de mais nada — quem
   * grava a resposta fecha o atendimento como 'resolvido' (lib/conversation-attendance.ts). */
  concluded?: boolean;
}

type KnowledgeCacheEntry = { text: string; expiresAt: number };
const knowledgeCache = new Map<string, KnowledgeCacheEntry>();

/**
 * Invalida imediatamente o cache de conhecimento e de configurações do chatbot
 * para garantir sincronização em tempo real quando FAQs, terapias ou salas mudam.
 */
export function invalidateKnowledgeCache(clinicId?: string): void {
  if (clinicId) {
    knowledgeCache.delete(clinicId);
    settingsCache.delete(clinicId);
  } else {
    knowledgeCache.clear();
    settingsCache.clear();
  }
}

/**
 * Monta o bloco de conhecimento do prompt a partir do banco. Em cache por
 * clínica com invalidação imediata quando o banco é editado.
 */
async function buildFaqKnowledge(clinicId: string): Promise<string> {
  const cached = knowledgeCache.get(clinicId);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const [faqRes, insurersRes, typesRes, roomsRes, therapistsRes, particularPricesRes, hoursRes] = await Promise.all([
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
    supabase
      .from("rooms")
      .select("name, is_evaluation_room")
      .eq("clinic_id", clinicId)
      .order("name"),
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("clinic_id", clinicId)
      .in("role", ["terapeuta", "profissional", "supervisor"])
      .order("full_name"),
    // Preço particular por terapia — tabela de preços do convênio
    // "Particular" (/gestor/cadastros/convenios/[id]/precos). Diferente dos
    // demais convênios (nunca expostos pelo bot), o gestor decidiu que o valor
    // particular PODE ser informado direto no WhatsApp (regra 6 do prompt).
    supabase
      .from("insurer_price_tables")
      .select("procedure_name, price, duration_minutes, valid_from, valid_to, insurers!inner(name, clinic_id, active)")
      .eq("insurers.clinic_id", clinicId)
      .eq("insurers.active", true)
      .ilike("insurers.name", PARTICULAR_INSURER_NAME)
      .order("procedure_name"),
    // Horário comercial da recepção (clinic_business_hours, migration
    // 20260920000000) — é o mesmo relógio que mede o tempo de resposta
    // humana, então o que o bot promete e o que o KPI cobra não divergem.
    supabase
      .from("clinic_business_hours")
      .select("day_of_week, open_time, close_time")
      .eq("clinic_id", clinicId)
      .order("day_of_week"),
  ]);

  const faqBlock = (faqRes.data ?? [])
    .map((row) => {
      const synonyms = (row.keywords ?? []).length ? ` (também perguntam como: ${(row.keywords ?? []).join(", ")})` : "";
      return `P: ${row.question}${synonyms}\nR: ${row.answer}`;
    })
    .join("\n\n");

  const insurersBlock = (insurersRes.data ?? [])
    .map((i) => i.name.trim())
    .filter((name) => name.toLowerCase() !== PARTICULAR_INSURER_NAME)
    .join(", ");

  const typesBlock = (typesRes.data ?? [])
    .map((t) => `${t.name} (${t.duration_minutes} min)`)
    .join(", ");

  const roomsBlock = (roomsRes.data ?? [])
    .map((r) => `${r.name}${r.is_evaluation_room ? " (Sala de Avaliação)" : ""}`)
    .join(", ");

  const therapistsBlock = (therapistsRes.data ?? [])
    .map((tp) => `${tp.full_name} (${tp.role})`)
    .join(", ");

  const businessHoursBlock = formatBusinessHours(hoursRes.data ?? []);

  const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const today = new Date().toISOString().slice(0, 10);
  const particularPricesBlock = (particularPricesRes.data ?? [])
    .filter((p) => p.valid_from <= today && (!p.valid_to || p.valid_to >= today))
    .map((p) => {
      const duration = p.duration_minutes ? ` (${p.duration_minutes} min)` : "";
      return `${p.procedure_name}: ${priceFormatter.format(Number(p.price))}${duration}`;
    })
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
    "",
    "=== VALORES PARTICULAR (sem convênio), por terapia ===",
    particularPricesBlock || "(nenhum valor particular cadastrado — escale pra equipe humana se perguntarem)",
    "",
    "=== HORÁRIO COMERCIAL DA RECEPÇÃO (atendimento humano) ===",
    businessHoursBlock || "(não cadastrado — não prometa horário nenhum)",
    "",
    "=== SALAS DE ATENDIMENTO E AVALIAÇÃO ===",
    roomsBlock || "(nenhuma sala cadastrada)",
    "",
    "=== EQUIPE E TERAPEUTAS ATIVOS ===",
    therapistsBlock || "(nenhum terapeuta cadastrado)",
  ].join("\n");

  knowledgeCache.set(clinicId, { text, expiresAt: Date.now() + KNOWLEDGE_TTL_MS });
  return text;
}

function buildSystemInstruction(knowledge: string): string {
  return `Você é a assistente virtual acolhedora do FaçaAmigos - Centro de Terapia Comportamental, uma clínica multidisciplinar especializada no desenvolvimento de crianças e adolescentes. Você conversa pelo WhatsApp com pais, mães e responsáveis legais.

${knowledge}

REGRAS OBRIGATÓRIAS:
1. MENSAGEM INICIAL DE BOAS-VINDAS: Na primeira interação de saudação, cite obrigatoriamente a marca completa: *FaçaAmigos - Centro de Terapia Comportamental*. Demonstre acolhimento. Exemplo de saudação ideal: "Olá! 💙 Boas-vindas ao *FaçaAmigos - Centro de Terapia Comportamental*! 🧩 Como podemos te ajudar hoje? (Ex: agendar avaliação, consultar planos de saúde ou tirar dúvidas)."
2. MENSAGENS CURTAS E DIRETAS: Seja extremamente objetivo, rápido de ler e direto ao ponto no celular (máximo 2 a 3 frases curtas ou tópicos breves). Evite explicações longas, parágrafos extensos ou enrolação.
3. ATENDIMENTO EMPÁTICO AOS PAIS E RESPONSÁVEIS: Fale diretamente com o pai, mãe ou responsável legal. Trate a família com carinho, respeito, clareza e acolhimento.
4. EMOJIS ACOLHEDORES: Use emojis integrativos e carinhosos (ex.: 💙, 🧩, 🎈, 🌱, 🤝, ✨) de forma harmoniosa nas mensagens.
5. NUNCA INVENTE: Responda APENAS com base nas informações acima. Se a resposta não estiver ali ou a dúvida não for coberta pela base, NUNCA invente: escale para a equipe humana.
6. POLÍTICA DE VALORES: Quando a pessoa perguntar o valor de atendimento PARTICULAR (sem convênio), informe diretamente o valor e a duração da terapia, usando exatamente os números da seção "VALORES PARTICULAR" acima — nunca arredonde ou estime, e não escale por isso. Valores de convênio (reembolso, coparticipação, tabela do plano) NÃO estão nesta base e NUNCA devem ser informados: escale para a equipe humana ("escalar": true, "motivo": "fora_da_base").
7. ISENÇÃO CLÍNICA: Jamais dê diagnóstico, opinião clínica, orientação médica ou conduta terapêutica. Qualquer pergunta clínica sobre a criança ou adolescente deve ser escalada para a equipe.
8. PRECISÃO: Nunca prometa valores, horários, vagas ou prazos que não estejam explicitamente confirmados acima.
9. HISTÓRICO: Considere o histórico da conversa: não repita a saudação nem reapresente a clínica se já conversou.
10. AGENDAMENTO E INÍCIO DE ATENDIMENTO 100% VIA BOT/WHATSAPP: O agendamento de avaliações e o início do atendimento acontecem integralmente POR AQUI no WhatsApp! NUNCA direcione a pessoa para o site para agendar, saber como iniciar ou marcar consultas. Se a pessoa perguntar sobre convênios (ex.: "vocês atendem PROASA?") ou demonstrar interesse em iniciar/agendar, responda confirmando o convênio e convide-a a agendar diretamente por aqui mesmo, orientando a responder *AGENDAR*.
11. NUNCA DIRECIONE PARA O SITE PARA AGENDAR OU INICIAR: O site oficial (www.institutofacaamigos.com.br) é EXCLUSIVAMENTE para consulta institucional/conhecer a clínica e deve ser incluído apenas como assinatura/despedida ao encerrar ou finalizar a conversa (Ex: "Conheça mais sobre nossa clínica em www.institutofacaamigos.com.br 🌐💙"). NUNCA associe o site a agendamentos, início de processo ou tira-dúvidas operacionais.
12. DOCUMENTOS DE CONVÊNIO: sempre que a conversa envolver um plano de saúde que NÃO seja particular, oriente que é preciso a *carteirinha do plano* (foto frente e verso) e o *número do cartão*. A *guia autorizada NÃO é obrigatória*: se a pessoa já tiver, ótimo; se não tiver, diga que a clínica faz a autorização — nunca condicione o agendamento à guia. Para atendimento particular, nada disso é necessário.
13. CURRÍCULO E VAGA DE EMPREGO (cuidado: "vaga" é palavra ambígua, leia o item 13.1 antes de usar): quando a pessoa fala de TRABALHO — quer enviar currículo, pergunta se a clínica está contratando, procura estágio ou oportunidade de emprego —, responda UMA ÚNICA mensagem, com "intent": "emprego" e "escalar": false, dizendo que não recebemos currículos nem tratamos de vagas de trabalho por aqui e que ela deve acessar www.institutofacaamigos.com.br e procurar *Trabalhe Conosco*. Essa mensagem ENCERRA o assunto: não faça perguntas, não ofereça ajuda extra, não chame a equipe humana e NUNCA peça que o currículo seja enviado por este WhatsApp — depois dela o atendimento automático é desligado e nada mais é respondido. Esta é a ÚNICA situação em que o site pode ser indicado como caminho para resolver algo (a regra 11 continua valendo para tudo o mais).
13.1 VAGA DE EMPREGO ≠ VAGA NA AGENDA: a maioria das pessoas que escreve "vaga" está perguntando por HORÁRIO DISPONÍVEL para atendimento do filho — isso é agendamento (regra 10), NUNCA "emprego". Exemplos que são AGENDAMENTO ("intent": "agendamento" ou "horarios", nunca "emprego"): "vocês têm vaga para avaliação?", "tem vaga essa semana?", "abriu vaga na terça de manhã?", "estão com vaga para fono?", "tem vaga pelo plano?", "quando abre vaga para ABA?". Exemplos que são EMPREGO: "vocês têm vaga de emprego?", "estão contratando psicóloga?", "posso mandar meu currículo?", "tem vaga para estágio?", "sou fonoaudióloga recém-formada, tem oportunidade de trabalho aí?". Só use "emprego" quando a mensagem disser com todas as letras que é trabalho/currículo/estágio/contratação — a palavra "vaga" sozinha NUNCA basta. Se ficar genuinamente em dúvida (ex.: "vocês têm vaga?" e o histórico não esclarece), NÃO use "emprego": pergunte em uma frase curta se é vaga na nossa agenda de atendimento ou vaga de trabalho ("intent": "outro", "escalar": false) e siga a resposta da pessoa.
14. MENSAGENS DE ÁUDIO: este contato não recebe mensagens de áudio — ninguém ouve notas de voz por aqui. Se a pessoa mandar áudio ou disser que vai mandar, peça com carinho que escreva a dúvida em texto. Nunca diga que vai ouvir depois nem que a equipe vai escutar o áudio.
15. HORÁRIO DO ATENDIMENTO HUMANO: sempre que avisar que a equipe/recepção vai responder (qualquer escalonamento, inclusive pedido de relatório), diga que o retorno acontece em horário comercial, citando exatamente a grade da seção "HORÁRIO COMERCIAL DA RECEPÇÃO" acima. Se a seção estiver vazia, diga apenas "em horário comercial", sem inventar horários. Você (assistente virtual) continua respondendo a qualquer hora — o horário vale para a resposta humana.

SOLICITAÇÃO DE RELATÓRIO OU DOCUMENTO (laudo, declaração de comparecimento, relatório de evolução, atestado, etc.):
Isso não é uma dúvida que você responde — é um pedido que a recepção vai atender, mas cabe a você reunir as informações antes de repassar, para a equipe não precisar perguntar tudo de novo.
1. Ao identificar esse pedido, NÃO escale na primeira mensagem. Pergunte em UMA única mensagem organizada (não escale ainda) o que ainda não foi dito no histórico: nome completo da criança/paciente, plano de saúde (ou "particular"), qual documento é necessário, e o nome do terapeuta responsável (se a pessoa souber). Se o plano NÃO for particular, peça também o número do cartão (carteirinha) do plano.
2. Se a resposta vier incompleta, pergunte só o que falta — no máximo mais uma vez; não insista além disso.
3. Depois de reunir o que for possível (mesmo incompleto), ESCALE (escalar=true, motivo="relatorio") e no campo "resposta" faça um resumo curto do que foi coletado, para a equipe ler direto sem precisar rolar a conversa. Exemplo: "Perfeito, já anotei! 💛 Vou repassar pra equipe: *Criança:* Maria Silva · *Plano:* Unimed · *Documento:* declaração de comparecimento · *Terapeuta:* Dra. Ana. Só um momento que já te retornam por aqui."
4. Junto com o "escalar=true, motivo=relatorio", preencha TAMBÉM o campo "relatorio_dados" com o que foi coletado (use null no que não foi informado) — é esse campo, não o texto da "resposta", que vira o aviso de pendência para o Supervisor providenciar junto ao terapeuta correspondente.

QUANDO ESCALAR (escalar = true):
- "fora_da_base": a informação pedida não está acima, ou refere-se a valores de convênio/reembolso (nunca informe esses).
- "clinico": pergunta sobre sintoma, diagnóstico, evolução ou conduta da criança.
- "pediu_humano": a pessoa pediu para falar com alguém, reclamou ou está claramente insatisfeita.
- "relatorio": pedido de relatório/documento, DEPOIS de reunir os dados acima — nunca na primeira mensagem do pedido.
Ao escalar por "fora_da_base", "clinico" ou "pediu_humano", o campo "resposta" deve apenas acolher e avisar que a equipe foi chamada, sem tentar responder a dúvida. Ao escalar por "relatorio", o campo "resposta" traz o resumo coletado (regra 3 acima) e "relatorio_dados" traz os mesmos dados de forma estruturada.

IDENTIFICAÇÃO DO PLANO: sempre que a pessoa disser QUAL plano de saúde a criança/paciente tem (ex.: "meu filho tem Unimed", "somos particular"), preencha "convenio" com o nome do plano exatamente como está na lista de CONVÊNIOS cadastrados acima (ou "Particular" se ela disser que é particular e esse nome estiver na lista). Perguntar se a clínica atende um plano NÃO conta — só quando ela afirma que possui o plano. Se o plano citado não estiver na lista, ou se ainda não souber, use null (e mantenha o valor se já foi dito antes no histórico).

Responda SEMPRE em JSON válido, exatamente neste formato:
{"resposta": "texto para enviar no WhatsApp", "escalar": false, "motivo": null, "intent": "planos", "convenio": null, "relatorio_dados": null, "concluido": false}

"motivo" é null quando escalar for false, senão um de: "fora_da_base", "clinico", "pediu_humano", "relatorio".
"intent" é um de: "planos", "valores", "local", "horarios", "terapias", "agendamento", "relatorio", "emprego", "outro". Use "emprego" APENAS para currículo/contratação/estágio (regras 13 e 13.1) — é sempre a última mensagem do bot naquela conversa; pergunta sobre vaga/horário disponível para atendimento é "agendamento" ou "horarios".
"relatorio_dados" é null exceto quando motivo="relatorio", caso em que é um objeto {"crianca": string ou null, "plano": string ou null, "carteirinha": string ou null (número do cartão do plano; null se particular ou não informado), "documento": string ou null, "terapeuta": string ou null}.
"concluido" é true SOMENTE quando a pessoa deu a conversa por encerrada (ex.: "obrigada, era só isso", "tchau", "ok, vou pensar") e a sua "resposta" é apenas a despedida, sem fazer nenhuma pergunta nem deixar nada pendente; em qualquer outro caso é false. Nunca é true junto com "escalar": true.`;
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
  carteirinha?: string | null;
  documento?: string | null;
  terapeuta?: string | null;
};

type FaqModelOutput = {
  resposta?: string;
  escalar?: boolean;
  motivo?: string | null;
  intent?: string;
  convenio?: string | null;
  relatorio_dados?: ReportRequestData | null;
  concluido?: boolean;
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
      `Plano de saúde: ${dados.plano ?? "não informado"}`,
      ...(dados.carteirinha ? [`Nº do cartão do plano: ${dados.carteirinha}`] : []),
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

function normalizePlanName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Grava na conversa o plano que a pessoa disse ter, para a Central de
 * Atendimento mostrar a pílula colorida. Só vale convênio cadastrado
 * (nome + cor oficiais); se não casar com nenhum, nada é gravado.
 */
async function saveDetectedPlan(conversationId: string, clinicId: string, rawPlan: string): Promise<void> {
  const typed = normalizePlanName(rawPlan);
  if (typed.length < 3) return;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: insurers } = await supabase.from("insurers").select("id, name").eq("clinic_id", clinicId);
    const match = (insurers ?? []).find((insurer) => {
      const known = normalizePlanName(insurer.name);
      return known.length >= 3 && (known === typed || typed.includes(known) || known.includes(typed));
    });
    if (!match) return;

    await supabase.from("twilio_conversations").update({ insurer_id: match.id }).eq("id", conversationId);
  } catch (err) {
    console.error("[Twilio FAQ Bot] Falha ao registrar plano identificado:", err);
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
      escalated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

/**
 * true quando "agora" cai dentro da grade de `clinic_business_hours` —
 * reusa `business_minutes_between` (mesma migration 20260920000000 que mede
 * o tempo de resposta humana) em vez de duplicar a lógica de dia-da-semana
 * em TS, então o que o bot informa e o que o KPI cobra nunca divergem.
 */
async function isWithinBusinessHoursNow(clinicId: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const now = new Date();
    const oneMinuteLater = new Date(now.getTime() + 60_000);
    const { data, error } = await supabase.rpc("business_minutes_between", {
      p_clinic_id: clinicId,
      p_from: now.toISOString(),
      p_to: oneMinuteLater.toISOString(),
    });
    if (error) throw error;
    return Number(data ?? 0) > 0;
  } catch (err) {
    console.error("[Twilio FAQ Bot] Falha ao checar horário comercial:", err);
    // Sem saber, não afirma nada sobre horário — melhor omitir o aviso do
    // que dizer "estamos fora do expediente" errado.
    return true;
  }
}

// Escalonamento fora do expediente: a resposta do Gemini já avisa que a
// equipe foi chamada, mas não sabe que ninguém vai ler antes do próximo
// expediente — sem isto a família ficava esperando resposta imediata à
// noite/fim de semana. Fixo (não depende do modelo) para nunca prometer
// hora errada.
const OUT_OF_HOURS_ESCALATION_SUFFIX =
  "\n\nEstamos fora do horário de atendimento da recepção agora — a equipe responde no próximo expediente. 💛";

/**
 * Assunto que o bot responde de uma vez e ENCERRA (hoje: currículo/vagas —
 * regra 13 do prompt). Diferente de escalar: ninguém é chamado, a conversa
 * não vai para a fila de pendências da recepção; o atendimento automático é
 * só desligado (`is_bot_active=false`) para que nenhuma outra mensagem desse
 * contato seja respondida. Se for engano (uma família de verdade que só
 * perguntou de vaga), a recepção religa o bot pelo toggle da Central.
 */
async function closeConversationAfterFinalReply(conversationId: string): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  await supabase
    .from("twilio_conversations")
    .update({ is_bot_active: false, status: "closed" })
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

  // Currículo/vaga de emprego SEM ambiguidade: resposta fixa e fim do assunto,
  // sem IA — o agente deixava a conversa aberta (intent "outro") e a candidata
  // seguia conversando com o bot. Roda antes do Gemini/cota: funciona mesmo com
  // a IA fora do ar e não gasta chamada. Marcas ambíguas ("quero trabalhar a
  // fala do meu filho") NÃO entram aqui — ver `hasStrongJobSignal`.
  if (hasStrongJobSignal(body)) {
    if (conversationId) await closeConversationAfterFinalReply(conversationId);
    return { handled: true, replyMessage: JOB_INQUIRY_REPLY, intent: "faq_emprego", escalated: false, concluded: true };
  }

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
    feature: "faq_whatsapp",
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

  if (conversationId && typeof parsed.convenio === "string" && parsed.convenio.trim()) {
    await saveDetectedPlan(conversationId, DEV_CLINIC_ID, parsed.convenio);
  }

  // Currículo/emprego: resposta única e fim do assunto — vale mesmo que o
  // modelo tenha marcado "escalar", que aqui seria só ruído para a recepção.
  //
  // A trava de `hasExplicitJobSignal` existe porque "vaga" em português é a
  // mesma palavra para emprego e para horário livre na agenda: se o modelo
  // confundir "tem vaga pra avaliação?" com candidatura, uma família levaria
  // a mensagem do Trabalhe Conosco e ficaria sem bot. Sem marca explícita de
  // trabalho na mensagem, a resposta é descartada e o fluxo segue para o
  // fallback de atendimento (AGENDAR/CONVÊNIOS) em lib/twilio.ts.
  if (parsed.intent === "emprego") {
    if (!hasExplicitJobSignal(body)) {
      console.warn("[Twilio FAQ Bot] intent=emprego sem marca de trabalho na mensagem — tratado como atendimento.");
      return notHandled;
    }
    if (conversationId) await closeConversationAfterFinalReply(conversationId);
    return { handled: true, replyMessage: reply, intent: "faq_emprego", escalated: false, concluded: true };
  }

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

  // "pediu_humano"/"clinico"/"fora_da_base" são pedidos de resposta
  // imediata do humano — "relatorio" já é um resumo de pendência, não uma
  // promessa de resposta agora, então não leva o aviso de horário.
  let finalReply = reply;
  if (shouldEscalate && reason !== "relatorio" && !(await isWithinBusinessHoursNow(DEV_CLINIC_ID))) {
    finalReply = `${reply}${OUT_OF_HOURS_ESCALATION_SUFFIX}`;
  }

  return {
    handled: true,
    replyMessage: finalReply,
    intent: shouldEscalate ? `escalado_${reason}` : `faq_${parsed.intent ?? "outro"}`,
    escalated: shouldEscalate,
    concluded: parsed.concluido === true && !shouldEscalate,
  };
}
