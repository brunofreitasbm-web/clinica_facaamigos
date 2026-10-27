import type { ConversationRow } from "./types";

const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** true quando a janela de 24h do WhatsApp já fechou (ou nunca esteve
 * aberta — contato sem mensagem inbound registrada) e só um template
 * aprovado consegue reabrir a conversa. */
export function isWhatsappWindowClosed(
  conversation: Pick<ConversationRow, "lastInboundAt">,
  now: number = Date.now(),
): boolean {
  if (!conversation.lastInboundAt) return true;
  return now - new Date(conversation.lastInboundAt).getTime() > WHATSAPP_SERVICE_WINDOW_MS;
}
