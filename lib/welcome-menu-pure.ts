// lib/welcome-menu-pure.ts
// Menu inicial do WhatsApp (lista interativa) e submenu Particular. PURO e sem
// import com alias `@/`, para rodar em `node --test --experimental-strip-types`
// (tests/welcome-menu-pure.test.ts). O envio e as ações ficam em
// lib/welcome-menu.ts.
//
// Estrutura:
//   MENU PRINCIPAL ─ 1 Particular ─► SUBMENU PARTICULAR (como funciona, valores,
//                                     agendar avaliação, atendente, voltar)
//                  ─ 2 Plano de saúde ─► fluxo AGENDAR existente
//                  ─ 3 Terapias · 4 Conhecer a clínica · 5 Dúvidas
//                  ─ 6 Currículos · 7 Outros assuntos
// Toda tela abaixo do menu principal tem a opção de voltar ao menu anterior.

import { JOB_INQUIRY_REPLY } from "./job-inquiry-pure.ts";

export const BRAND_NAME = "FaçaAmigos - Centro de Terapia Comportamental";

/** Emojis do padrão FaçaAmigos (neurodiversidade). Sem arco-íris, por decisão do dono. */
export const BRAND_EMOJIS = ["🧩", "💙", "♾️", "✨", "🌱", "🤝"] as const;

// ---------------------------------------------------------------------------
// Intents gravados em `messages.intent` pelo bot. O "menu anterior" é deduzido
// do intent da última mensagem do bot (sem tabela de estado).
// ---------------------------------------------------------------------------
export const MENU_INTENT = "menu_inicial";
export const PARTICULAR_MENU_INTENT = "menu_particular";
export const PARTICULAR_COMO_FUNCIONA_INTENT = "part_como_funciona";
export const PARTICULAR_VALORES_INTENT = "part_valores";
export const PARTICULAR_COLETA_INTENT = "particular_agendar_coleta";

/** Motivos de escalonamento novos (texto livre em `twilio_conversations.escalation_reason`). */
export const ESCALATION_PARTICULAR = "particular";
export const ESCALATION_PARTICULAR_AGENDAR = "particular_agendar";

export type MenuOption = { id: string; title: string; description?: string };

/** Título de item de lista do WhatsApp: no máximo 24 caracteres. */
export const LIST_TITLE_MAX = 24;
/** Descrição de item de lista: no máximo 72 caracteres. */
export const LIST_DESCRIPTION_MAX = 72;
/** Uma lista do WhatsApp aceita até 10 itens. */
export const LIST_ITEMS_MAX = 10;

export const WELCOME_MENU_OPTIONS: MenuOption[] = [
  { id: "menu_particular", title: "Atendimento particular", description: "Como funciona e valores" },
  { id: "menu_plano", title: "Plano de saúde", description: "Agendar com a guia do convênio" },
  { id: "menu_terapias", title: "Terapias que atendemos", description: "Conheça nossas especialidades" },
  { id: "menu_conhecer", title: "Quero conhecer a clínica", description: "Endereço e horários" },
  { id: "menu_duvidas", title: "Dúvidas", description: "Pergunte o que quiser" },
  { id: "menu_curriculo", title: "Currículos", description: "Trabalhe com a gente" },
  { id: "menu_outros", title: "Outros assuntos", description: "Falar com a nossa equipe" },
];

export const PARTICULAR_MENU_OPTIONS: MenuOption[] = [
  { id: "part_como_funciona", title: "Como funciona", description: "Da avaliação às sessões" },
  { id: "part_valores", title: "Valores das sessões", description: "Planos mensais" },
  { id: "part_agendar", title: "Agendar avaliação", description: "Nossa equipe marca para você" },
  { id: "part_humano", title: "Falar com atendente", description: "Atendimento humano" },
  { id: "nav_back", title: "↩ Voltar ao menu" },
];

export const NAV_BACK_ID = "nav_back";
export const PART_AGENDAR_ID = "part_agendar";

// ---------------------------------------------------------------------------
// Normalização e leitura das respostas
// ---------------------------------------------------------------------------
export function normalizeMenuText(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[↩️*_~]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resposta a uma lista: toque (ID), número digitado ou título (a Twilio manda o
 * título tocado em `Body`). `null` quando a mensagem não é uma escolha.
 */
function parseOptionReply(
  input: { body?: string | null; listId?: string | null; buttonPayload?: string | null },
  options: MenuOption[],
): string | null {
  const id = (input.listId ?? input.buttonPayload ?? "").trim();
  if (id) {
    if (options.some((o) => o.id === id)) return id;
    // ID de outra lista (ex.: "nav_back" tocado num botão): não é desta.
    return null;
  }

  const text = normalizeMenuText(input.body);
  if (!text) return null;

  const number = /^(\d{1,2})$/.exec(text);
  if (number) {
    const option = options[Number(number[1]) - 1];
    return option && option.id !== NAV_BACK_ID ? option.id : null;
  }

  const byTitle = options.find((o) => normalizeMenuText(o.title) === text);
  return byTitle ? byTitle.id : null;
}

export function parseWelcomeMenuReply(input: { body?: string | null; listId?: string | null; buttonPayload?: string | null }): string | null {
  return parseOptionReply(input, WELCOME_MENU_OPTIONS);
}

/** No submenu, o último número é "Voltar ao menu" (cobre o texto numerado de reserva). */
export function parseParticularMenuReply(input: { body?: string | null; listId?: string | null; buttonPayload?: string | null }): string | null {
  const id = (input.listId ?? input.buttonPayload ?? "").trim();
  if (id === NAV_BACK_ID) return NAV_BACK_ID;
  const text = normalizeMenuText(input.body);
  if (text === String(PARTICULAR_MENU_OPTIONS.length)) return NAV_BACK_ID;
  return parseOptionReply(input, PARTICULAR_MENU_OPTIONS);
}

/** Telas "Como funciona" e "Valores": 1 = agendar avaliação, 2 = voltar. */
export function parseParticularActionReply(input: { body?: string | null; listId?: string | null; buttonPayload?: string | null }): string | null {
  const id = (input.listId ?? input.buttonPayload ?? "").trim();
  if (id === PART_AGENDAR_ID || id === NAV_BACK_ID) return id;
  const text = normalizeMenuText(input.body);
  if (text === "1" || text === "agendar avaliacao") return PART_AGENDAR_ID;
  if (text === "2") return NAV_BACK_ID;
  return null;
}

const NAV_BACK_WORDS = new Set(["voltar", "volta", "0", "menu anterior", "voltar ao menu", "retornar", "voltar menu"]);
const MAIN_MENU_WORDS = new Set(["menu", "menu principal", "inicio", "opcoes", "ver opcoes"]);

export type NavReply = "back" | "menu" | null;

/** "VOLTAR" (menu anterior) e "MENU" (principal): só valem com a mensagem inteira. */
export function parseNavReply(input: { body?: string | null; listId?: string | null; buttonPayload?: string | null }): NavReply {
  const id = (input.listId ?? input.buttonPayload ?? "").trim();
  if (id === NAV_BACK_ID) return "back";
  const text = normalizeMenuText(input.body);
  if (NAV_BACK_WORDS.has(text)) return "back";
  if (MAIN_MENU_WORDS.has(text)) return "menu";
  return null;
}

export type MenuScreen = "main" | "particular";

/** Para onde "voltar" leva, a partir do intent da última mensagem do bot. */
export function previousMenuFor(lastBotIntent: string | null | undefined): MenuScreen {
  switch (lastBotIntent) {
    case PARTICULAR_COMO_FUNCIONA_INTENT:
    case PARTICULAR_VALORES_INTENT:
    case PARTICULAR_COLETA_INTENT:
      return "particular";
    default:
      return "main";
  }
}

// ---------------------------------------------------------------------------
// Textos fixos (emojis do padrão FaçaAmigos, sem arco-íris)
// ---------------------------------------------------------------------------
export const WELCOME_MENU_BODY =
  `Olá! 💙 Boas-vindas ao *${BRAND_NAME}*! 🧩\n\n` +
  "Como podemos te ajudar hoje? Toque em *Ver opções* e escolha uma delas. ✨";

export const PARTICULAR_MENU_BODY =
  "Que bom ter vocês por aqui! 💙\nO que você gostaria de saber sobre o atendimento *particular*? 🌱";

function numbered(options: MenuOption[]): string {
  return options.map((o, i) => `*${i + 1}* - ${o.title}`).join("\n");
}

/** Texto de reserva (sem o Content da lista configurado). */
export const WELCOME_MENU_TEXT =
  `Olá! 💙 Boas-vindas ao *${BRAND_NAME}*! 🧩\n\n` +
  "Como podemos te ajudar hoje?\n\n" +
  `${numbered(WELCOME_MENU_OPTIONS)}\n\n` +
  "Responda apenas com o *número* da opção. ✨";

export const PARTICULAR_MENU_TEXT =
  `${PARTICULAR_MENU_BODY}\n\n${numbered(PARTICULAR_MENU_OPTIONS.map((o) => (o.id === NAV_BACK_ID ? { ...o, title: "Voltar ao menu" } : o)))}\n\n` +
  "Responda apenas com o *número* da opção. ✨";

export const BACK_TO_MENU_FOOTER = "Para voltar ao menu, responda *VOLTAR*. 💙";
export const BACK_TO_PARTICULAR_FOOTER = "Responda *1* para agendar a avaliação ou *2* para voltar. 💙";

/** Mesma mensagem que o prompt da IA usa para currículo: uma só fonte. */
export const CURRICULO_REPLY = JOB_INQUIRY_REPLY;

export const DUVIDAS_PROMPT =
  "Claro! 💙 Escreva a sua dúvida por aqui (planos de saúde, terapias, valores...) que já respondemos. ✨\n\n" +
  BACK_TO_MENU_FOOTER;

export const HUMANO_HANDOFF = "Certo! 💙 Chamei a nossa equipe, que continua o atendimento por aqui em horário comercial. 🤝";

export const PARTICULAR_COMO_FUNCIONA =
  "Veja como funciona o atendimento particular. 🧩\n\n" +
  "1️⃣ *Avaliação inicial*: uma conversa com a família para entender a história e as necessidades da criança.\n" +
  "2️⃣ *Plano Terapêutico Singular (PTS)*: a equipe monta os objetivos e a frequência das sessões.\n" +
  "3️⃣ *Sessões de 40 minutos*, com a participação da família como parte do tratamento. 💙\n\n" +
  "A avaliação inicial já faz parte do plano escolhido: ela conta como 1 das sessões do mês. Sem plano, é uma sessão avulsa de R$ 190. 🌱\n\n" +
  BACK_TO_PARTICULAR_FOOTER;

export const PARTICULAR_AGENDAR_COLETA =
  "Vamos agendar a avaliação! 💙 Para a nossa equipe já chegar preparada, me conta em uma única mensagem:\n\n" +
  "• nome e idade da criança;\n" +
  "• o que vocês têm observado;\n" +
  "• o melhor período (manhã ou tarde).\n\n" +
  "Para voltar, responda *VOLTAR*. 🧩";

export const PARTICULAR_AGENDAR_OBRIGADO =
  "Perfeito, já anotei tudo! 🌱 Nossa equipe confirma o melhor horário para a avaliação e retorna por aqui";

// ---------------------------------------------------------------------------
// Terapias (nomes comerciais enviados pelo dono em out/2026; não vêm do banco)
// ---------------------------------------------------------------------------
export type CommercialTherapy = { name: string; focus: string };

export const COMMERCIAL_THERAPIES: CommercialTherapy[] = [
  { name: "Terapia ABA", focus: "comunicação funcional, autonomia e ampliação de repertório" },
  { name: "Psicologia", focus: "regulação emocional, autoestima e suporte em cada fase" },
  { name: "Fonoaudiologia", focus: "linguagem, fala, comunicação alternativa e deglutição" },
  { name: "Terapia Ocupacional", focus: "vida diária, coordenação motora fina, brincar e independência" },
  { name: "T.O. com Integração Sensorial", focus: "modulação sensorial, planejamento motor e regulação" },
  { name: "Fisioterapia", focus: "desenvolvimento motor, tônus, marcha e postura" },
  { name: "Psicopedagogia", focus: "aprendizagem, alfabetização e adaptação escolar" },
  { name: "Psicomotricidade", focus: "esquema corporal, equilíbrio e coordenação global" },
  { name: "Musicoterapia", focus: "comunicação, interação e expressão emocional pela música" },
  { name: "Nutrição", focus: "seletividade alimentar e orientação à família" },
  { name: "Educação Física Adaptada", focus: "habilidades motoras, esporte adaptado e socialização" },
  { name: "Treino de Habilidades Sociais", focus: "interação com pares, regras sociais e amizade" },
  { name: "Orientação Parental", focus: "manejo em casa e acolhimento da família" },
  { name: "Avaliação Neuropsicológica", focus: "atenção, memória, funções executivas e apoio ao diagnóstico" },
];

export function buildTherapiesMessage(): string {
  const lines = COMMERCIAL_THERAPIES.map((t) => `🧩 *${t.name}*: ${t.focus}`).join("\n");
  return `Estas são as terapias que atendemos no *${BRAND_NAME}*: ✨\n\n${lines}\n\n${BACK_TO_MENU_FOOTER}`;
}

// ---------------------------------------------------------------------------
// Planos particulares (reserva em código; o bot lê os valores vigentes do banco)
// ---------------------------------------------------------------------------
export type ParticularPlan = { name: string; sessions: number; price: number };

export const PARTICULAR_PLANS: ParticularPlan[] = [
  { name: "Encontro (sessão avulsa)", sessions: 1, price: 190 },
  { name: "Primeiro Passo", sessions: 4, price: 720 },
  { name: "Laço", sessions: 8, price: 1400 },
  { name: "Vínculo", sessions: 12, price: 1990 },
  { name: "Turma", sessions: 16, price: 2580 },
  { name: "Abraço", sessions: 20, price: 3120 },
  { name: "Voo Livre", sessions: 24, price: 3640 },
];

export const NEURO_EVALUATION_PRICE = 2500;

const brl = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function formatBrl(value: number): string {
  return brl(value);
}

/** Menor valor por sessão entre os planos (ex.: Voo Livre = R$ 151,67). */
export function lowestPricePerSession(plans: ParticularPlan[]): number {
  return Math.min(...plans.map((p) => p.price / p.sessions));
}

/** Texto de valores sem imagem: planos, regras e convite para a avaliação. */
export function buildParticularPricesText(plans: ParticularPlan[] = PARTICULAR_PLANS): string {
  const lines = plans
    .map((p) => (p.sessions === 1 ? `💙 *${p.name}*: ${brl(p.price)}` : `💙 *${p.name}* · ${p.sessions} sessões/mês: ${brl(p.price)}`))
    .join("\n");
  return (
    "Cada plano é montado após a avaliação e pensado para a evolução da criança. 🌱\n\n" +
    `${lines}\n\n` +
    `Quanto mais sessões, menor o valor de cada uma: a partir de ${brl(lowestPricePerSession(plans))} por sessão no plano mais completo. ` +
    "As sessões podem combinar terapias diferentes, e a avaliação inicial conta como 1 sessão do plano. " +
    "Cada bloco de Treino ABA (3 sessões seguidas) conta como 3 sessões. Parcelamos em até 3x no cartão. ✨\n\n" +
    `A avaliação neuropsicológica tem valor fechado de ${brl(NEURO_EVALUATION_PRICE)}.\n\n` +
    BACK_TO_PARTICULAR_FOOTER
  );
}

/** Legenda curta da imagem de valores (a tabela completa está na arte). */
export function buildParticularPricesCaption(plans: ParticularPlan[] = PARTICULAR_PLANS): string {
  return (
    "Cada plano é montado após a avaliação. 🌱 A avaliação inicial conta como 1 sessão do plano, " +
    `e quanto mais sessões, menor o valor de cada uma (a partir de ${brl(lowestPricePerSession(plans))}). Parcelamos em até 3x no cartão. 💙\n\n` +
    BACK_TO_PARTICULAR_FOOTER
  );
}

// ---------------------------------------------------------------------------
// Plano de saúde e "conhecer a clínica"
// ---------------------------------------------------------------------------
export function buildPlanoIntro(insurerNames: string[]): string {
  const list = insurerNames.length > 0 ? insurerNames.map((n) => `*${n}*`).join(", ") : "nossos convênios parceiros";
  return (
    `Que bom! 💙 Atendemos ${list}. Vou te ajudar a pedir a autorização da guia junto ao plano: ` +
    "preciso de alguns dados da criança e de fotos do laudo (ou pedido médico), da carteirinha e do RG ou CNH do responsável. 🧩\n\n" +
    "Qual o seu *nome completo* (responsável)?\n\n" +
    "_Para voltar ao menu, responda VOLTAR. Para falar com a equipe, responda ATENDENTE._"
  );
}

export function buildConhecerMessage(params: { address?: string | null; mapsUrl?: string | null; hours?: string | null }): string {
  const parts = [`Que bom que você quer conhecer o *${BRAND_NAME}*! 🧩`];
  if (params.address) parts.push(`📍 ${params.address}`);
  if (params.mapsUrl) parts.push(`Como chegar: ${params.mapsUrl}`);
  if (params.hours) parts.push(`🕐 ${params.hours}`);
  parts.push("Para agendar uma visita, responda *ATENDENTE* e a nossa equipe combina com você. 🤝\n\n" + BACK_TO_MENU_FOOTER);
  return parts.join("\n\n");
}
