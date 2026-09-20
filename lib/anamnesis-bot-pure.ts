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
