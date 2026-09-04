/**
 * Status de appointment que representam uma sessão que não vai acontecer
 * (cancelada ou remarcada) — nunca devem contar como "agendada"/"realizada"
 * pra fins de progresso de estágio do paciente.
 */
export const CANCELLED_APPOINTMENT_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "remarcada",
] as const;

export function computeStage(
  patient: { status: string; evaluated_at: string | null; first_session_at: string | null },
  hasEvaluationScheduled: boolean,
  hasActiveAuthorization: boolean,
): 1 | 2 | 3 | 4 | 5 {
  if (patient.status === "ativo" || patient.first_session_at) return 5;
  if (hasActiveAuthorization) return 4;
  if (patient.evaluated_at) return 3;
  if (hasEvaluationScheduled || patient.status === "avaliacao") return 2;
  return 1;
}
