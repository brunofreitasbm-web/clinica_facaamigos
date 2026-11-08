/**
 * Definição única de "paciente ativo" nos painéis do gestor.
 * Decisão do dono (2026-11-08): paciente de fato = agendou E EXECUTOU a 1ª
 * avaliação (patients.evaluated_at preenchido, gravado no check-out da
 * avaliação). Lead do chatbot ou criança só agendada NÃO conta.
 * Todo contador do gestor combina estes status COM evaluated_at not null.
 * (Antes: ativo = em tratamento OU em avaliação, o que inflava o número.)
 */
export const ACTIVE_PATIENT_STATUSES = ["ativo", "avaliacao"] as const;

/** Rótulos de exibição dos status de paciente (nunca mostrar o valor cru na tela). */
export const PATIENT_STATUS_LABEL: Record<string, string> = {
  interessado: "Interessado",
  avaliacao: "Em avaliação",
  ativo: "Em tratamento",
  pausado: "Pausado",
  alta: "Alta",
  evadido: "Evadido",
};

/**
 * Etapa do paciente de fato (já fez a 1ª avaliação) no gestor. Derivada, não
 * gravada: Avaliado → Aguardando o PTS → PTS feito → Em tratamento.
 * - Em tratamento: status "ativo" ou 1ª sessão da grade já aconteceu.
 * - PTS feito: plano terapêutico aprovado.
 * - Aguardando o PTS: plano em rascunho (sendo elaborado).
 * - Avaliado: avaliação executada, ainda sem plano.
 * Quem não executou a 1ª avaliação cai no rótulo cru de PATIENT_STATUS_LABEL.
 */
export type PatientJourneyStage = "avaliado" | "aguardando_pts" | "pts_feito" | "em_tratamento";

export const PATIENT_JOURNEY_LABEL: Record<PatientJourneyStage, string> = {
  avaliado: "Avaliado",
  aguardando_pts: "Aguardando o PTS",
  pts_feito: "PTS feito",
  em_tratamento: "Em tratamento",
};

export function computeJourneyStage(
  patient: { status: string; first_session_at: string | null },
  planStatuses: readonly string[],
): PatientJourneyStage {
  if (patient.status === "ativo" || patient.first_session_at) return "em_tratamento";
  if (planStatuses.includes("aprovado")) return "pts_feito";
  if (planStatuses.includes("rascunho")) return "aguardando_pts";
  return "avaliado";
}
