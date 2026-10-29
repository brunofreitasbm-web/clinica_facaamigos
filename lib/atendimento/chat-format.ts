/**
 * Formatação e agrupamento de mensagens do chat mobile (/m/atendimento), no
 * estilo WhatsApp: separador de dia ("Hoje", "Ontem", "12 de outubro"), cauda
 * da bolha só na primeira de uma sequência do mesmo lado e horário curto na
 * lista de conversas. Puro (sem React/DOM) para ser testável com node:test.
 * `timeZone` indefinido = fuso do aparelho, que é o que a recepção vê.
 */

export type ChatMessageLike = {
  id: string;
  direction: string;
  senderType: string;
  sentAt: string | null;
};

export type ChatItem<M extends ChatMessageLike> =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: M; groupStart: boolean };

function dayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dayNumber(date: Date, timeZone?: string): number {
  const [y, m, d] = dayKey(date, timeZone).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function formatClock(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
}

/** Rótulo do separador de dia dentro da conversa. */
export function formatDayLabel(iso: string, now: Date = new Date(), timeZone?: string): string {
  const date = new Date(iso);
  const diff = dayNumber(now, timeZone) - dayNumber(date, timeZone);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  const sameYear = dayKey(date, timeZone).slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
  return date.toLocaleDateString("pt-BR", {
    timeZone,
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Carimbo da lista de conversas: hora se for hoje, "Ontem", dia da semana na última semana, senão dd/mm/aa. */
export function formatListTimestamp(iso: string | null | undefined, now: Date = new Date(), timeZone?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const diff = dayNumber(now, timeZone) - dayNumber(date, timeZone);
  if (diff <= 0) return formatClock(iso, timeZone);
  if (diff === 1) return "Ontem";
  if (diff < 7) return date.toLocaleDateString("pt-BR", { timeZone, weekday: "long" }).replace(/-feira$/, "");
  return date.toLocaleDateString("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Lado visual da bolha: o que a clínica enviou (agente ou bot) fica à direita. */
function side(m: ChatMessageLike): "out" | "in" {
  return m.direction === "outbound" ? "out" : "in";
}

/**
 * Intercala separadores de dia e marca o início de cada sequência do mesmo
 * remetente (agente, bot e contato são remetentes distintos, pois o bot tem
 * rótulo próprio). `messages` deve vir em ordem cronológica.
 */
export function buildChatItems<M extends ChatMessageLike>(
  messages: M[],
  now: Date = new Date(),
  timeZone?: string,
): ChatItem<M>[] {
  const items: ChatItem<M>[] = [];
  let lastDay: string | null = null;
  let previous: M | null = null;

  for (const message of messages) {
    let startsNewDay = false;
    if (message.sentAt) {
      const date = new Date(message.sentAt);
      if (!isNaN(date.getTime())) {
        const key = dayKey(date, timeZone);
        if (key !== lastDay) {
          lastDay = key;
          startsNewDay = true;
          items.push({ kind: "day", key: `day-${key}`, label: formatDayLabel(message.sentAt, now, timeZone) });
        }
      }
    }
    const groupStart =
      startsNewDay ||
      previous === null ||
      side(previous) !== side(message) ||
      (side(message) === "out" && previous.senderType !== message.senderType);
    items.push({ kind: "message", key: message.id, message, groupStart });
    previous = message;
  }

  return items;
}

/**
 * Mensagem do operador que ainda não apareceu via realtime (envio otimista).
 * Considera "chegou" quando existe uma mensagem outbound recente com o mesmo texto.
 */
export function hasEchoedMessage(
  persisted: { direction: string; body: string | null; sentAt: string | null; deliveryStatus?: string | null }[],
  pending: { body: string; createdAt: number },
): boolean {
  const wanted = pending.body.trim();
  return persisted.some(
    (m) =>
      m.direction === "outbound" &&
      // Uma linha "failed" não é eco: no reenvio ela tem o mesmo texto e a otimista não pode sumir por causa dela.
      m.deliveryStatus !== "failed" &&
      (m.body ?? "").trim() === wanted &&
      m.sentAt !== null &&
      new Date(m.sentAt).getTime() >= pending.createdAt - 60_000,
  );
}
