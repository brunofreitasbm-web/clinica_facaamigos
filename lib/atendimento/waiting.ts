import type { ConversationRow } from "./types";

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
