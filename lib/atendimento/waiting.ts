import { toLastMessageSender, type ConversationRow } from "./types.ts";

/**
 * Desde quando o contato espera resposta da clínica — `null` quando a bola
 * não está com a clínica. Usa `lastMessageSender` (trigger
 * trg_conversation_last_sender): o contato falou por último em conversa não
 * encerrada, conta desde a última mensagem dele. Antes disso o badge só
 * aparecia em conversa `pending` (escalada pelo bot) e contava desde a
 * última mensagem de QUALQUER lado — uma resposta do bot zerava o relógio.
 * Conversa escalada (`pending`) segue aguardando até um HUMANO responder,
 * mesmo que o bot tenha mandado a última ("vou te passar pra equipe").
 * Sem o campo (linha antiga não carimbada), mantém a regra anterior.
 */
export function waitingSince(
  c: Pick<ConversationRow, "status" | "lastMessageSender" | "lastInboundAt" | "lastMessageAt">,
): string | null {
  if (c.status === "closed") return null;
  if (c.lastMessageSender) {
    const waiting =
      c.lastMessageSender === "contact" || (c.status === "pending" && c.lastMessageSender !== "agent");
    return waiting ? (c.lastInboundAt ?? c.lastMessageAt) : null;
  }
  return c.status === "pending" ? c.lastMessageAt : null;
}

type WaitingCountRow = {
  status: string;
  last_message_sender: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
};

/**
 * Quantas conversas esperam resposta da clínica (mesma regra de `waitingSince`).
 * Alimenta o balão do botão flutuante do chat: quando qualquer pessoa responde,
 * `last_message_sender` vira "agent" e a conversa sai da contagem.
 */
export function countWaiting(rows: readonly WaitingCountRow[]): number {
  return rows.reduce(
    (n, r) =>
      waitingSince({
        status: r.status as ConversationRow["status"],
        lastMessageSender: toLastMessageSender(r.last_message_sender),
        lastInboundAt: r.last_inbound_at,
        lastMessageAt: r.last_message_at,
      })
        ? n + 1
        : n,
    0,
  );
}
