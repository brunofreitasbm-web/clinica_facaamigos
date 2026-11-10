/**
 * Detecta o erro do PostgREST/Postgres para as colunas novas da Fila de entrada
 * (plan_denied_at/by, plan_more_docs_at/by) quando a migration ainda não foi aplicada.
 * 42703 = undefined_column.
 */
const INTAKE_COLUMN_NAMES = ["plan_denied_at", "plan_denied_by", "plan_more_docs_at", "plan_more_docs_by"];

export const INTAKE_MIGRATION_PENDING_MESSAGE = "Esta ação precisa da atualização do banco de dados (migration pendente).";

export function isMissingIntakeColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = error.message ?? "";
  return INTAKE_COLUMN_NAMES.some((name) => message.includes(name));
}
