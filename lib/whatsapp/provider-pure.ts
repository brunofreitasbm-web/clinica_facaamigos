// Escolha do provedor de WhatsApp — pura (sem SDK nem alias "@/"), para ser
// testável com `node --test`. Ver docs/migracao-whatsapp-cloud-api.md.

export type WhatsAppProviderId = "twilio" | "meta";

/**
 * Lê `WHATSAPP_PROVIDER`. Ausente ou vazio = "twilio" (comportamento atual).
 * Valor desconhecido NÃO cai em silêncio para outro provedor: devolve `null`
 * para o chamador falhar alto, em vez de mandar mensagem por um canal que o
 * operador não escolheu.
 */
export function resolveWhatsAppProviderId(raw: string | undefined): WhatsAppProviderId | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "" || value === "twilio") return "twilio";
  if (value === "meta") return "meta";
  return null;
}
