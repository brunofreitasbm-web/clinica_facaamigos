// lib/closed-chat-filter-pure.ts
// Regra PURA: lead cuja conversa de WhatsApp já foi ENCERRADA na recepção não deve
// poluir "Autorizações" como "não tratado". Sem import com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/closed-chat-filter-pure.test.ts).
//
// Só some quem NÃO tem processo de autorização andando: guia enviada, plano que
// autorizou, dispensa e devolução da supervisão são trabalho real e continuam
// visíveis mesmo com o chat fechado. Se a família escrever de novo, o webhook reabre
// a conversa e o lead volta sozinho.

export type ConversationStatusRow = { phone_number: string | null; status: string | null };

/** Telefones cujas conversas existem e estão TODAS encerradas. */
export function phonesWithOnlyClosedChats(rows: ConversationStatusRow[]): Set<string> {
  const hasOpen = new Set<string>();
  const hasClosed = new Set<string>();
  for (const row of rows) {
    if (!row.phone_number) continue;
    (row.status === "closed" ? hasClosed : hasOpen).add(row.phone_number);
  }
  return new Set([...hasClosed].filter((phone) => !hasOpen.has(phone)));
}

export function isHiddenByClosedChat(
  draft: { sourcePhone: string | null; pipeline: { authorization: string; returned: unknown } } | null | undefined,
  closedPhones: ReadonlySet<string>,
): boolean {
  if (!draft?.sourcePhone || !closedPhones.has(draft.sourcePhone)) return false;
  return draft.pipeline.authorization === "pendente" && !draft.pipeline.returned;
}
