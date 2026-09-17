// lib/group-slot-rules.ts
//
// Espelho em TS puro do trigger `appointments_group_capacity_guard`
// (supabase/migrations/20260917170400_group_psychotherapy_guard.sql) — usado
// pela UI (app/recepcao/nova-sessao-dialog.tsx) para desabilitar o botão de
// agendar ANTES de bater no banco, evitando um round-trip só para descobrir
// que o grupo está lotado ou que a criança está fora da faixa etária. O
// trigger no Postgres continua sendo a autoridade final (condição de corrida
// entre dois cliques simultâneos é resolvida lá via
// `pg_advisory_xact_lock`) — esta função é só uma pré-checagem otimista.
//
// Sem I/O: recebe as datas de nascimento já carregadas (RPC
// `group_slot_occupancy` ou dados já em mãos) e devolve se a criança nova
// pode entrar no grupo.

/** Soma `years` anos de calendário a uma data (aritmética simples em UTC). */
function addYears(d: Date, years: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));
}

/**
 * "A diferença entre `a` e `b` é maior que `thresholdYears` anos?" — no
 * mesmo espírito de `extract(year from age(a, b)) > N` do Postgres: em vez
 * de truncar em anos completos (o que deixaria "2 anos e 1 dia" ainda como
 * "2"), compara a data mais distante contra o aniversário de N anos da mais
 * próxima — assim "exatamente 2 anos" fica na borda (ok) e "2 anos e 1 dia"
 * já estoura (bloqueia), como o PRD pede.
 */
function exceedsYearGap(a: Date, b: Date, thresholdYears: number): boolean {
  const [earlier, later] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
  const boundary = addYears(earlier, thresholdYears);
  return later.getTime() > boundary.getTime();
}

export type GroupSlotCheckResult = { ok: true } | { ok: false; reason: "lotado" | "faixa_etaria" };

/**
 * Espelha `appointments_group_capacity_guard`: primeiro checa capacidade
 * (GRUPO_LOTADO), depois — só se já há alguém no horário — a faixa etária
 * (GRUPO_FAIXA_ETARIA, diferença > 2 anos em relação à criança mais nova OU
 * mais velha já agendada).
 */
export function canJoinGroupSlot({
  existingBirthDates,
  maxSize,
  candidateBirthDate,
}: {
  existingBirthDates: Date[];
  maxSize: number;
  candidateBirthDate: Date;
}): GroupSlotCheckResult {
  if (existingBirthDates.length >= maxSize) {
    return { ok: false, reason: "lotado" };
  }

  if (existingBirthDates.length === 0) {
    return { ok: true };
  }

  const minBirth = existingBirthDates.reduce((min, d) => (d < min ? d : min));
  const maxBirth = existingBirthDates.reduce((max, d) => (d > max ? d : max));

  const tooFar =
    exceedsYearGap(candidateBirthDate, minBirth, 2) || exceedsYearGap(candidateBirthDate, maxBirth, 2);

  if (tooFar) {
    return { ok: false, reason: "faixa_etaria" };
  }

  return { ok: true };
}
