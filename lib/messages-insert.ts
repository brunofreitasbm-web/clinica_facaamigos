// lib/messages-insert.ts
// Insert em `messages` tolerante à migration de `sent_by` ainda não aplicada.
// Ver lib/messages-insert-pure.ts: REMOVER depois de aplicar a migration em produção.

import { isMissingSentByColumn, withoutSentBy } from "@/lib/messages-insert-pure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** Grava a linha; se a coluna `sent_by` ainda não existe no banco, refaz sem ela. */
export async function insertMessageRow(
  client: Loose,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const first = await client.from("messages").insert(row);
  if (isMissingSentByColumn(first.error)) {
    console.warn("[messages] coluna sent_by ausente: aplique a migration 20261109130000_messages_sent_by.sql");
    return client.from("messages").insert(withoutSentBy(row));
  }
  return first;
}
