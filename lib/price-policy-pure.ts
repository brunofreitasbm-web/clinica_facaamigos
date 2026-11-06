// lib/price-policy-pure.ts
// Regra de preço do bot de WhatsApp da clínica. PURO e sem import com alias `@/`
// (tests/price-policy-pure.test.ts roda em `node --test --experimental-strip-types`).
//
// Regra (base de conhecimento da clínica, seções 6, 10, 11 e 12):
//   - O bot NUNCA escreve valor em texto. Preço só sai na ARTE de pacotes.
//   - Particular, ou pergunta de pacote/plano/valor/preço sem tipo conhecido →
//     primeiro pergunta "convênio ou particular?"; sendo particular, envia a arte
//     com a frase fixa e transborda para humano.
//   - Convênio (IASEP, PROASA ou outro): nunca informa preço; transborda.
//   - Arte já enviada na conversa: não reenvia, só transborda.
// O envio, o transbordo e a leitura do histórico ficam em lib/price-policy.ts.

/** Arte dos 6 pacotes particulares (hospedada no site do Instituto). */
export const PRICE_ART_URL = "https://institutofacaamigos.com.br/chatbot-clinica/planos-particular.png";

/** Frase que acompanha a arte (texto fixo, sem valor). */
export const PRICE_ART_CAPTION =
  "Estes são os pacotes mensais. A quantidade e a distribuição das terapias dependem de cada criança. " +
  "Vou te passar para a equipe, que monta a melhor opção com você.";

/** Tipo de atendimento desconhecido: pergunta antes de enviar qualquer coisa. */
export const PRICE_ASK_TYPE_QUESTION = "É por convênio ou particular?";

/** Convênio: nunca informa preço. */
export const PRICE_CONVENIO_REPLY =
  "Pelo convênio, a clínica solicita a autorização da guia. Vou te passar para a equipe.";

/** Particular que já recebeu a arte: não reenvia. */
export const PRICE_ART_ALREADY_SENT_REPLY =
  "Os pacotes mensais já estão na imagem que enviei acima. Vou te passar para a equipe, que monta a melhor opção com você.";

/** Intent gravado em `messages.intent` quando o bot pergunta o tipo de atendimento. */
export const PRICE_ASK_TYPE_INTENT = "preco_pergunta_tipo";
/** Intent da resposta de convênio / arte já enviada (só transbordo). */
export const PRICE_CONVENIO_INTENT = "preco_convenio";
export const PRICE_ART_ALREADY_SENT_INTENT = "preco_arte_ja_enviada";

export type AttendanceType = "particular" | "convenio";

export function normalizePriceText(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9$ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "plano" sozinho é ambíguo (plano de saúde x plano mensal): só vale com "mensal"
// ou "particular". "quanto" sozinho também ("quanto tempo dura?"): exige o verbo de custo.
const PRICE_QUESTION: RegExp[] = [
  /\b(preco|precos|valor|valores|custo|custos|custa|custam|mensalidade|mensalidades|investimento|orcamento)\b/,
  /\b(pacote|pacotes)\b/,
  /\b(plano|planos) (mensal|mensais|particular|particulares)\b/,
  /\bquanto (e|eh|sao|fica|ficam|sai|saem|cobra|cobram|cobrar|pago|paga|pagar|vou pagar|se paga|custa|custam)\b/,
  /\btabela de (preco|precos|valor|valores)\b/,
  /\bsessao avulsa\b/,
];

/** A mensagem pergunta pacote/plano/valor/preço. */
export function isPriceQuestion(body: string | null | undefined): boolean {
  const text = normalizePriceText(body);
  return !!text && PRICE_QUESTION.some((re) => re.test(text));
}

const PARTICULAR_RE =
  /\b(particular|particulares|sem convenio|sem plano|sem plano de saude|nao tenho (convenio|plano)|nao temos (convenio|plano))\b/;
const CONVENIO_RE =
  /\b(iasep|proasa|convenio|convenios|plano de saude|planos de saude|unimed|hapvida|bradesco|amil|sulamerica|cassi|amazonia saude|pelo plano|reembolso)\b/;

/**
 * Tipo de atendimento dito na mensagem. `null` quando não diz, ou quando diz os
 * dois ("convênio ou particular?"): nesse caso o bot pergunta.
 */
export function detectAttendanceType(body: string | null | undefined): AttendanceType | null {
  const text = normalizePriceText(body);
  if (!text) return null;
  const particular = PARTICULAR_RE.test(text);
  // "sem convênio" e "não tenho plano" contêm a palavra do convênio, mas dizem o contrário.
  const convenio = CONVENIO_RE.test(text.replace(PARTICULAR_RE, " "));
  if (particular && convenio) return null;
  if (particular) return "particular";
  if (convenio) return "convenio";
  return null;
}

export type ConversationEntry = { sender: "user" | "bot"; body: string | null; intent: string | null };

/**
 * Tipo de atendimento já conhecido da conversa. `entries` vem do mais recente
 * para o mais antigo. Vale o que a pessoa disse por último; sem isso, o menu
 * que ela escolheu (Particular x Plano de saúde).
 */
export function inferKnownAttendanceType(entries: ConversationEntry[]): AttendanceType | null {
  for (const e of entries) {
    if (e.sender === "user") {
      const said = detectAttendanceType(e.body);
      if (said) return said;
    } else {
      const intent = e.intent ?? "";
      if (intent === "menu_plano" || intent === "acolhimento_plano_saude" || intent === PRICE_CONVENIO_INTENT) return "convenio";
      if (intent === "menu_particular" || intent.startsWith("part_") || intent.startsWith("particular_")) return "particular";
    }
  }
  return null;
}

export type PriceStep =
  | { kind: "none" }
  | { kind: "ask_type" }
  | { kind: "send_art" }
  | { kind: "art_already_sent" }
  | { kind: "convenio" };

/**
 * Decide o que fazer com a mensagem. `awaitingType`: a última mensagem do bot
 * foi a pergunta "convênio ou particular?" (então "particular" sozinho é resposta).
 */
export function decidePriceStep(input: {
  body: string;
  awaitingType: boolean;
  knownType: AttendanceType | null;
  artSent: boolean;
}): PriceStep {
  const said = detectAttendanceType(input.body);
  const asksPrice = isPriceQuestion(input.body);
  if (!asksPrice && !(input.awaitingType && said)) return { kind: "none" };

  const type = said ?? input.knownType;
  if (!type) return { kind: "ask_type" };
  if (type === "convenio") return { kind: "convenio" };
  return input.artSent ? { kind: "art_already_sent" } : { kind: "send_art" };
}

const MONEY_PATTERNS: RegExp[] = [/r\s*\$\s*\d/i, /\d\s*(reais|real)\b/i, /\b\d+\s*mil\s*reais\b/i];

/** Texto com valor em reais ("R$ 190", "190 reais"). O bot nunca pode enviar isso. */
export function containsMoney(text: string | null | undefined): boolean {
  const value = text ?? "";
  return MONEY_PATTERNS.some((re) => re.test(value));
}
