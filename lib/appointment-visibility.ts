// lib/appointment-visibility.ts
/**
 * Fonte única de "sessão que não ocorreu" (cancelada ou remarcada).
 *
 * Essas sessões saem de TODA tela operacional (agenda, grade, ficha, família,
 * terapeuta, supervisão) e dos KPIs; ficam só na auditoria do gestor
 * (/gestor/auditoria/sessoes) para rastreabilidade.
 *
 * `falta_familia` NÃO entra aqui de propósito: a recepção ainda acompanha a
 * remarcação da falta. O histórico clínico do paciente (lib/patient-journey-pure.ts)
 * continua mostrando cancelamentos — não use este filtro lá.
 */
export const NON_OCCURRED_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "remarcada",
] as const;

export function isNonOccurredStatus(status: string): boolean {
  return (NON_OCCURRED_STATUSES as readonly string[]).includes(status);
}

/** Valor para `.not("status", "in", NON_OCCURRED_IN_FILTER)` do PostgREST. */
export const NON_OCCURRED_IN_FILTER = `(${NON_OCCURRED_STATUSES.join(",")})`;

/** Aplica o filtro a um query builder de `appointments` do Supabase. */
export function excludeNonOccurred<
  Q extends { not: (column: string, operator: string, value: unknown) => Q },
>(query: Q): Q {
  return query.not("status", "in", NON_OCCURRED_IN_FILTER);
}

export function filterOccurred<T extends { status: string }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !isNonOccurredStatus(r.status));
}
