export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Faixa de urgência da fila de pendências — o que a recepção faz primeiro:
 *   agora  → escalado, atrasado, ou gente esperando no balcão (chegada);
 *   hoje   → prazo até o fim do dia, no fuso da clínica;
 *   depois → prazo em outro dia, ou sem prazo.
 */
export type UrgencyBand = "agora" | "hoje" | "depois";

export const BAND_ORDER: UrgencyBand[] = ["agora", "hoje", "depois"];

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Número do dia (dias desde a época) de `date` no fuso `timeZone`. */
export function dayNumberInTimeZone(date: Date, timeZone: string): number {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, f);
  }
  let year = 0, month = 0, day = 0;
  for (const p of f.formatToParts(date)) {
    if (p.type === "year") year = Number(p.value);
    else if (p.type === "month") month = Number(p.value);
    else if (p.type === "day") day = Number(p.value);
  }
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function urgencyBand(
  item: { category: string; overdue: boolean; escalated: boolean; dueAt: string | null },
  now: Date,
  timeZone: string,
): UrgencyBand {
  if (item.escalated || item.overdue || item.category === "chegada_nao_confirmada") return "agora";
  if (!item.dueAt) return "depois";
  const due = new Date(item.dueAt);
  if (isNaN(due.getTime())) return "depois";
  return dayNumberInTimeZone(due, timeZone) <= dayNumberInTimeZone(now, timeZone) ? "hoje" : "depois";
}

/** Palavras da busca, já sem acento e em minúsculas. */
export function searchTokens(search: string): string[] {
  const normalized = normalizeSearch(search);
  return normalized ? normalized.split(/\s+/) : [];
}

/**
 * Busca da fila: TODAS as palavras precisam aparecer (E), em qualquer ordem.
 * Telefone: uma busca só de dígitos/pontuação de telefone ("(91) 98888-7777")
 * casa pelos dígitos, a partir de 4 — assim o formato digitado não importa.
 */
export function matchesSearch(haystack: string, search: string): boolean {
  const tokens = searchTokens(search);
  if (tokens.length === 0) return true;
  const haystackDigits = haystack.replace(/\D/g, "");
  const allDigits = search.replace(/\D/g, "");
  if (/^[\d\s()+.-]+$/.test(search.trim()) && allDigits.length >= 4) {
    return haystackDigits.includes(allDigits);
  }
  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    const digits = token.replace(/\D/g, "");
    return digits.length >= 4 && haystackDigits.includes(digits);
  });
}

/**
 * Trechos de `text` com as palavras da busca marcadas, para destacar o nome na
 * lista. Compara sem acento, mas devolve o texto original.
 */
export function highlightSegments(text: string, search: string): { text: string; match: boolean }[] {
  const tokens = searchTokens(search).filter((t) => t.length > 0);
  if (tokens.length === 0) return [{ text, match: false }];
  // Um caractere normalizado por caractere original (os acentos combinantes somem).
  const folded = Array.from(text, (ch) => normalizeSearch(ch).charAt(0) || ch.toLowerCase().charAt(0));
  const flat = folded.join("");
  const marked = new Array<boolean>(folded.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = flat.indexOf(token, from);
      if (at === -1) break;
      for (let i = at; i < at + token.length && i < marked.length; i++) marked[i] = true;
      from = at + token.length;
    }
  }
  const chars = Array.from(text);
  const segments: { text: string; match: boolean }[] = [];
  chars.forEach((ch, i) => {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[i]) last.text += ch;
    else segments.push({ text: ch, match: marked[i] });
  });
  return segments;
}
