/**
 * Formata o telefone E.164 da conversa para leitura na Central. Conversas de
 * lead não têm nome cadastrado, então o número é o identificador que a
 * recepção enxerga na lista.
 */
export function formatConversationPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;

  if (national.length === 11) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return raw;
}
