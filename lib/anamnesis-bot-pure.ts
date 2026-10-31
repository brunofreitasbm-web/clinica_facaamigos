// lib/anamnesis-bot-pure.ts
// Validação/parse PUROS das respostas do bot de anamnese por WhatsApp
// (lib/twilio-anamnesis-bot.ts). Sem imports com alias `@/`, para que
// `node --test --experimental-strip-types` (tests/anamnesis-bot-pure.test.ts)
// consiga importá-lo sem passar pelo bundler do Next. Os validadores de
// e-mail/nome (`normalizeEmail`/`normalizeFullName` de lib/whatsapp-lead-pure.ts)
// entram por parâmetro: o tsconfig não permite import relativo com extensão
// `.ts`, e assim a regra do lead continua definida num só lugar.

export type Normalizer = (raw: string | null | undefined) => string | null;

function stripAccents(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * "Não tenho" / "pular" e variações. Só reconhece a resposta CURTA e inteira
 * (ex.: "não tenho e-mail"), para não confundir com um e-mail que por acaso
 * contenha "nao" ou "pular".
 */
export function isSkipAnswer(raw: string | null | undefined): boolean {
  const text = stripAccents(raw ?? "")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > 40 || text.includes("@")) return false;
  return /^(nao|n|pular|pula|pulo|skip|sem email|sem e-mail|nao tenho|nao possuo|nao tem|nao uso|nenhum|nao quero|prefiro nao)( (tenho|possuo|tem|uso|quero|informar|e-?mail|email|e mail|pular|dar|enviar|meu|nenhum)){0,3}$/.test(text);
}

export type GuardianEmailAnswer =
  | { kind: "email"; email: string }
  | { kind: "skip" }
  | { kind: "invalid" };

/** Interpreta a resposta da etapa `awaiting_guardian_email`. */
export function parseGuardianEmailAnswer(
  raw: string | null | undefined,
  normalizeEmail: Normalizer,
): GuardianEmailAnswer {
  const email = normalizeEmail(raw);
  if (email) return { kind: "email", email };
  if (isSkipAnswer(raw)) return { kind: "skip" };
  return { kind: "invalid" };
}

export type GuardianEmailDecision =
  | { action: "save"; email: string }
  | { action: "reask" }
  | { action: "accept_skip" }
  | { action: "invalid" };

/**
 * Regra de produto: o cliente quer o e-mail dos responsáveis. Na primeira vez
 * que a pessoa recusa ("não tenho"/"pular") pedimos de novo (`reask`); só a
 * segunda recusa (`alreadyAskedAgain`) é aceita e grava vazio.
 */
export function decideGuardianEmailStep(
  raw: string | null | undefined,
  alreadyAskedAgain: boolean,
  normalizeEmail: Normalizer,
): GuardianEmailDecision {
  const parsed = parseGuardianEmailAnswer(raw, normalizeEmail);
  if (parsed.kind === "email") return { action: "save", email: parsed.email };
  if (parsed.kind === "skip") return alreadyAskedAgain ? { action: "accept_skip" } : { action: "reask" };
  return { action: "invalid" };
}

/** Nome completo (>= 2 palavras) ou null — mesma regra do lead (`normalizeFullName`). */
export function parseFullNameAnswer(raw: string | null | undefined, normalizeFullName: Normalizer): string | null {
  return normalizeFullName(raw);
}

// ---------------------------------------------------------------------
// Fluxo AGENDAR enxuto (auditoria out/2026): leitura por PALAVRA INTEIRA.
// Antes era `includes("nao")`/`includes("sim")`, então "não sei" virava NÃO,
// "assim" virava SIM e "reagendar" abria o fluxo de agendamento.
// ---------------------------------------------------------------------

/** Minúsculo, sem acento, só letras/dígitos separados por um espaço. */
export function normalizeAnswer(raw: string | null | undefined): string {
  return stripAccents(raw ?? "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NEGATED_INTENT = /\b(nao|nem|sem)\b( \w+){0,2} (agendar|marcar)\b/;

/** Pedido EXPLÍCITO de agendar: "agendar", "quero marcar avaliação"… Nunca "reagendar"/"não quero agendar". */
export function isAgendarIntent(raw: string | null | undefined): boolean {
  const text = normalizeAnswer(raw);
  if (!text || NEGATED_INTENT.test(text)) return false;
  return /\b(agendar|anamnese)\b/.test(text) || /\bmarcar (a |uma )?(avaliacao|consulta)\b/.test(text);
}

export type YesNo = "yes" | "no" | null;

const YES = /^(sim|s|ss|tenho|possuo|claro|yes|positivo|ja tenho|tenho sim|sim tenho|sim ja tenho|sim possuo)$/;
const NO = /^(nao|n|nn|no|negativo|ainda nao|nao tenho|nao possuo|nao tem|tenho nao|nao ainda|nenhum|nenhuma|ainda nao tenho)$/;

/** SIM/NÃO só quando a resposta INTEIRA é uma dessas formas curtas; senão null. */
export function parseYesNo(raw: string | null | undefined): YesNo {
  const text = normalizeAnswer(raw);
  if (YES.test(text)) return "yes";
  if (NO.test(text)) return "no";
  return null;
}

const LATER = /^(depois|mando depois|envio depois|vou mandar depois|vou enviar depois|mais tarde|agora nao|nao estou com ele|nao estou com ela|nao tenho agora|nao tenho aqui|nao esta comigo|pular|pula)$/;

/** "Não tenho" / "envio depois" na etapa de um documento opcional ou pendente. */
export function isNoDocumentAnswer(raw: string | null | undefined): boolean {
  const text = normalizeAnswer(raw);
  return parseYesNo(raw) === "no" || LATER.test(text);
}

const DONE = /^(pronto|prontos|pronta|feito|terminei|terminamos|finalizei|finalizado|era isso|so isso|e isso|e so|enviei tudo|mandei tudo|ja enviei|ja mandei|ja enviei tudo|ja mandei tudo)( obrigad[oa])?$/;

/** "PRONTO" (e variações curtas) ao fim do envio de documentos, na etapa que junta todos os anexos. */
export function isDoneAnswer(raw: string | null | undefined): boolean {
  return DONE.test(normalizeAnswer(raw));
}

export type DocumentSlots = {
  laudo?: string;
  guia?: string;
  carteirinha_frente?: string;
  carteirinha_verso?: string;
  documento_identidade?: string;
};

/**
 * Distribui os arquivos enviados de uma vez (já em ordem de chegada, com a categoria que a IA
 * deu a cada um) nos campos da solicitação. Categoria reconhecida manda: laudo/pedido médico →
 * laudo, autorização → guia, carteirinha → frente/verso, documento_identidade → RG. Quem ainda
 * está como "outro" (IA não leu a tempo) ocupa os campos que sobraram, na ordem
 * laudo → carteirinha (frente, verso) → RG: é palpite — a supervisão confere no painel.
 */
export function assignDocumentSlots(files: { pointer: string; category: string | null }[]): DocumentSlots {
  const slots: DocumentSlots = {};
  const cards: string[] = [];
  const unclassified: string[] = [];

  for (const file of files) {
    switch (file.category) {
      case "laudo":
      case "pedido_medico":
        slots.laudo ??= file.pointer;
        break;
      case "autorizacao":
        slots.guia ??= file.pointer;
        break;
      case "carteirinha":
        cards.push(file.pointer);
        break;
      case "documento_identidade":
        slots.documento_identidade ??= file.pointer;
        break;
      case "outro":
      case null:
      case undefined:
        unclassified.push(file.pointer);
        break;
      default:
        break;
    }
  }

  if (cards[0]) {
    slots.carteirinha_frente = cards[0];
    // PDF único cobre frente e verso; senão a segunda foto é o verso.
    slots.carteirinha_verso = cards[1] ?? (cards[0].toLowerCase().endsWith(".pdf") ? cards[0] : undefined);
  }

  const queue = [...unclassified];
  if (!slots.laudo && queue.length > 0) slots.laudo = queue.shift();
  if (!slots.carteirinha_frente && queue.length > 0) slots.carteirinha_frente = queue.shift();
  if (slots.carteirinha_frente && !slots.carteirinha_verso && queue.length > 0) slots.carteirinha_verso = queue.shift();
  if (!slots.documento_identidade && queue.length > 0) slots.documento_identidade = queue.shift();

  return slots;
}

export type ExitCommand = "stop" | "human" | "back" | null;

/**
 * PARAR/SAIR/CANCELAR encerram o fluxo; ATENDENTE/HUMANO pedem a equipe. Só
 * quando a mensagem INTEIRA é o comando: "qual o telefone da recepção?" é
 * dúvida (vai para o FAQ), não pedido de atendente.
 */
export function parseExitCommand(raw: string | null | undefined): ExitCommand {
  const text = normalizeAnswer(raw);
  if (!text || text.split(" ").length > 5) return null;
  if (/^(quero |gostaria de |preciso |posso )?(falar com )?(um |uma |o |a )?(atendente|humano|humana|pessoa|alguem|recepcao|equipe)( por favor| pfv| pf)?$/.test(text)) {
    return "human";
  }
  if (/^(parar|pare|sair|cancelar|cancela|encerrar|stop)( (o )?(agendamento|atendimento|fluxo|tudo))?$/.test(text)) return "stop";
  // VOLTAR/MENU: sai do fluxo e reabre o menu inicial (o rascunho é guardado como no PARAR).
  if (/^(voltar|volta|menu|voltar ao menu|menu anterior|retornar|0)$/.test(text)) return "back";
  return null;
}

export type PlanOption = { id: string; name: string };

export type PlanAnswer =
  | { kind: "particular" }
  /** Respondeu PARTICULAR, mas a conversa já foi identificada com um plano. */
  | { kind: "particular_blocked"; known: PlanOption }
  | { kind: "insurer"; id: string; name: string }
  | { kind: "generic_convenio" }
  | { kind: "not_served"; typed: string }
  | { kind: "invalid" };

const GENERIC_CONVENIO = /^(convenio|convenios|plano|plano de saude|pelo plano|pelo convenio|por convenio|e convenio|e pelo plano|tenho plano|tenho convenio|e plano)$/;

/**
 * Resposta à pergunta "qual plano?". Casa o nome digitado com os convênios
 * ativos (mesma regra de `saveDetectedPlan` em lib/twilio-faq-bot.ts: igual ou
 * um contém o outro, mínimo 3 letras). Texto curto que não casa = plano que a
 * clínica NÃO atende (avisar já, sem pedir documento).
 */
export function parsePlanAnswer(
  raw: string | null | undefined,
  insurers: PlanOption[],
  /** Plano já identificado na conversa: com ele, PARTICULAR não é aceito. */
  knownInsurer?: PlanOption | null,
): PlanAnswer {
  const text = normalizeAnswer(raw);
  if (!text) return { kind: "invalid" };
  if (/\bparticular\b/.test(text)) {
    return knownInsurer ? { kind: "particular_blocked", known: knownInsurer } : { kind: "particular" };
  }
  for (const insurer of insurers) {
    const known = normalizeAnswer(insurer.name);
    if (known.length < 3) continue;
    if (known === text || ` ${text} `.includes(` ${known} `) || (text.length >= 3 && ` ${known} `.includes(` ${text} `))) {
      return { kind: "insurer", id: insurer.id, name: insurer.name };
    }
  }
  if (GENERIC_CONVENIO.test(text)) return { kind: "generic_convenio" };
  if (parseYesNo(raw) !== null || text.length < 3 || text.split(" ").length > 6) return { kind: "invalid" };
  return { kind: "not_served", typed: (raw ?? "").trim() };
}

export type TherapyOption = { value: string; label: string };

export type TherapiesAnswer =
  | { kind: "therapies"; values: string[]; labels: string[] }
  | { kind: "unsure" }
  | { kind: "invalid" };

/** Terapias que o bot oferece (chaves de `specialties.value`), na ordem em que são listadas. */
export const BOT_THERAPY_VALUES = [
  "psicologia_aba",
  "fonoaudiologia",
  "terapia_ocupacional",
  "fisioterapia",
  "musicoterapia",
  "psicopedagogia",
  "nutricao",
] as const;

/** Apelidos por `specialties.value` (palavra inteira, sem acento). */
const THERAPY_ALIASES: Record<string, string[]> = {
  fonoaudiologia: ["fono", "fonoaudiologa", "fonoaudiologo"],
  terapia_ocupacional: ["to", "t o", "ocupacional"],
  psicologia_aba: ["psico", "psicologia", "psicologa", "psicologo", "aba"],
  fisioterapia: ["fisio", "fisioterapeuta"],
  musicoterapia: ["musico", "musica"],
  psicopedagogia: ["psicoped", "psicopedagoga", "psicopedagogo"],
  nutricao: ["nutri", "nutricionista"],
};

const THERAPY_UNSURE = /\b(nao sei|nao tenho certeza|em duvida|duvida|indeciso|indecisa|avaliacao|so avaliacao|quero avaliacao)\b/;

/**
 * Resposta à pergunta "quais terapias?". Aceita números da lista ("1 e 3"),
 * nome ou apelido (fono, TO, ABA…), uma ou várias. "Não sei"/"avaliação" segue
 * sem terapia; o resto é `invalid` (o bot pergunta de novo uma vez).
 */
export function parseTherapiesAnswer(raw: string | null | undefined, options: TherapyOption[]): TherapiesAnswer {
  const text = normalizeAnswer(raw);
  if (!text) return { kind: "invalid" };
  const padded = ` ${text} `;
  const picked = new Set<string>();

  for (const token of text.match(/\b\d+\b/g) ?? []) {
    const option = options[Number(token) - 1];
    if (option) picked.add(option.value);
  }
  for (const option of options) {
    const names = [normalizeAnswer(option.label), ...(THERAPY_ALIASES[option.value] ?? [])].filter((n) => n.length > 0);
    if (names.some((name) => padded.includes(` ${name} `))) picked.add(option.value);
  }

  if (picked.size > 0) {
    const chosen = options.filter((o) => picked.has(o.value));
    return { kind: "therapies", values: chosen.map((o) => o.value), labels: chosen.map((o) => o.label) };
  }
  if (THERAPY_UNSURE.test(text)) return { kind: "unsure" };
  return { kind: "invalid" };
}

/**
 * Etapas do fluxo antigo (14 mensagens) → etapa equivalente do fluxo enxuto,
 * para quem parou no meio continuar de onde estava. `legacy_identity` = estava
 * respondendo CPF ou e-mail: o handler aproveita a resposta se vier válida e
 * segue para o nome da criança.
 */
export function canonicalAnamnesisStep(step: string): string {
  switch (step) {
    case "awaiting_guardian_cpf":
    case "awaiting_guardian_email":
      return "legacy_identity";
    case "awaiting_payment_mode":
      return "awaiting_plan";
    case "awaiting_has_laudo":
    case "awaiting_laudo_pdf":
      return "awaiting_laudo";
    case "awaiting_has_guia":
    case "awaiting_guia_pdf":
    case "awaiting_carteirinha_frente":
      return "awaiting_carteirinha";
    default:
      return step;
  }
}

/** Na etapa do RG, quantas respostas em texto aceitar antes de seguir sem ele. */
export const MAX_TEXT_REPLIES_FOR_DOCUMENT = 2;
