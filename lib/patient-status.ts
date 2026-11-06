/**
 * Definição única de "paciente ativo" nos painéis do gestor.
 * Decisão do dono (2026-11-06): ativo = em tratamento OU em avaliação.
 */
export const ACTIVE_PATIENT_STATUSES = ["ativo", "avaliacao"] as const;
