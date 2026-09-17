// lib/absence-policy.ts
//
// Política de desligamento automático por faltas consecutivas não
// justificadas (FASE 5 do plano de fluxos novos). A decisão de negócio
// (2 faltas consecutivas sem justificativa aprovada → desligamento) já é
// aplicada no Postgres pela função `apply_auto_discharge` (disparada pelo
// trigger `trg_appointments_auto_discharge` em `appointments`, ver
// supabase/migrations/20260917170500_auto_discharge_consecutive_faltas.sql)
// — este módulo NÃO decide nem executa nada no banco, só espelha em TS puro
// a mesma contagem que a função SQL `unjustified_consecutive_faltas` faz,
// para uso em UI (indicador "1/2 faltas consecutivas não justificadas").

/** Mesmo limiar usado pelo trigger no banco — 2 faltas consecutivas sem justificativa aprovada. */
export const AUTO_DISCHARGE_THRESHOLD = 2;

export type AbsenceSession = {
  status: "realizada" | "falta_familia";
  /** true quando a falta tem um `absence_reports.status = 'aprovado'` vinculado. */
  justified: boolean;
};

/**
 * Conta faltas consecutivas não justificadas a partir do início da lista —
 * `sessions` deve vir ordenada da mais recente para a mais antiga (mesma
 * convenção usada para alimentar `patient_absence_stats`/`unjustified_
 * consecutive_faltas` no banco). Para no primeiro `realizada` ou na primeira
 * falta já justificada.
 */
export function countConsecutiveUnjustified(sessions: AbsenceSession[]): number {
  let count = 0;
  for (const session of sessions) {
    if (session.status === "realizada") break;
    // session.status === "falta_familia"
    if (session.justified) break;
    count += 1;
  }
  return count;
}
