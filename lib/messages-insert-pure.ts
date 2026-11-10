// lib/messages-insert-pure.ts
// Tolerância TEMPORÁRIA à ordem de implantação da migration 20261109130000_messages_sent_by.sql.
// Se o deploy do código sair antes da migration, o insert com `sent_by` falharia por coluna
// inexistente e a recepção ficaria sem conseguir enviar mensagem. Aqui o insert é refeito
// sem a coluna. REMOVER (e voltar ao insert direto) depois de aplicar a migration em produção.
// Sem import com alias `@/` para rodar em `node --test` (tests/messages-insert-pure.test.ts).

type DbError = { message?: string | null; code?: string | null } | null | undefined;

/** O erro é "a coluna messages.sent_by não existe" (Postgres 42703 ou cache do PostgREST PGRST204)? */
export function isMissingSentByColumn(error: DbError): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  if (!msg.includes("sent_by")) return false;
  return error.code === "42703" || error.code === "PGRST204" || msg.includes("column") || msg.includes("schema cache");
}

/** Mesma linha sem `sent_by`. */
export function withoutSentBy<T extends Record<string, unknown>>(row: T): Omit<T, "sent_by"> {
  const { sent_by: _ignored, ...rest } = row;
  void _ignored;
  return rest;
}
