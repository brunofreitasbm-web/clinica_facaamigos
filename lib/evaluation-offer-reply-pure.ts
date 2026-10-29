// lib/evaluation-offer-reply-pure.ts
// Interpretação PURA da resposta do responsável no fluxo de oferta de horários
// da 1ª avaliação. A mesma resposta pode chegar de três jeitos, e o parser
// aceita todos: toque num botão/item de lista (payload/ID), número digitado
// ("2") ou o texto do item (a Twilio costuma mandar o título tocado em `Body`).
// Sem import com alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/evaluation-offer-reply-pure.test.ts).

export const EVAL_BUTTON_YES = "eval_yes";
export const EVAL_BUTTON_NO = "eval_no";
export const EVAL_LIST_NONE = "none";
export const EVAL_LIST_HUMAN = "human";
export const evalListSlotId = (index: number) => `slot_${index}`;

export type OfferReply =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "stop" }
  | { kind: "slot"; index: number }
  | { kind: "none" }
  | { kind: "human" }
  /** Toque em "Ver horários" do lembrete quando a lista já tinha sido enviada: reenvia a mesma lista. */
  | { kind: "resend" }
  | { kind: "invalid" };

export type OfferReplyInput = {
  body: string;
  buttonPayload?: string | null;
  listId?: string | null;
};

export type OfferedSlotLabel = { index: number; label: string };

export function normalizeReply(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 :/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set(["parar", "pare", "sair", "stop", "cancelar", "descadastrar"]);
const YES_WORDS = new Set(["1", "sim", "s", "quero", "quero agendar", "pode", "pode agendar", "ok", "agendar"]);
const NO_WORDS = new Set(["2", "nao", "n", "agora nao", "nao quero", "depois"]);

/** Passo 1: responsável quer agendar? ("Quero agendar" / "Agora não"). */
export function parseInterestReply(input: OfferReplyInput): OfferReply {
  if (input.buttonPayload === EVAL_BUTTON_YES) return { kind: "yes" };
  if (input.buttonPayload === EVAL_BUTTON_NO) return { kind: "no" };

  const text = normalizeReply(input.body);
  if (STOP_WORDS.has(text)) return { kind: "stop" };
  if (YES_WORDS.has(text)) return { kind: "yes" };
  if (NO_WORDS.has(text)) return { kind: "no" };
  return { kind: "invalid" };
}

/**
 * Passo 2: escolha do horário. Numeração do texto de reserva: 1..N = horários,
 * N+1 = "Nenhum serve", N+2 = "Falar com atendente" — igual à ordem do menu.
 */
export function parseSlotReply(input: OfferReplyInput, slots: OfferedSlotLabel[]): OfferReply {
  // Botões do template de lembrete: o lembrete também vale para quem já recebeu a lista.
  if (input.buttonPayload === EVAL_BUTTON_YES) return { kind: "resend" };
  if (input.buttonPayload === EVAL_BUTTON_NO) return { kind: "stop" };

  const listId = (input.listId ?? input.buttonPayload ?? "").trim();
  if (listId) {
    const m = /^slot_(\d+)$/.exec(listId);
    if (m) {
      const index = Number(m[1]);
      return slots.some((s) => s.index === index) ? { kind: "slot", index } : { kind: "invalid" };
    }
    if (listId === EVAL_LIST_NONE) return { kind: "none" };
    if (listId === EVAL_LIST_HUMAN) return { kind: "human" };
  }

  const text = normalizeReply(input.body);
  if (STOP_WORDS.has(text)) return { kind: "stop" };

  if (/^\d+$/.test(text)) {
    const n = Number(text);
    if (slots.some((s) => s.index === n)) return { kind: "slot", index: n };
    const last = Math.max(0, ...slots.map((s) => s.index));
    if (n === last + 1) return { kind: "none" };
    if (n === last + 2) return { kind: "human" };
    return { kind: "invalid" };
  }

  if (text.startsWith("nenhum serve") || text.includes("outros horarios")) return { kind: "none" };
  if (text.includes("atendente")) return { kind: "human" };

  // Título do item tocado: casa pelo rótulo normalizado.
  const byLabel = slots.find((s) => normalizeReply(s.label) === text);
  if (byLabel) return { kind: "slot", index: byLabel.index };

  return { kind: "invalid" };
}
