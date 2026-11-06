/**
 * Definição única de "paciente ativo" nos painéis do gestor.
 * Decisão do dono (2026-11-06): ativo = em tratamento OU em avaliação.
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
