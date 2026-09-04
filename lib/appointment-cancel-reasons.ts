// lib/appointment-cancel-reasons.ts
/**
 * Lista fechada de motivos de falta/cancelamento — PRD §9.2. Usada tanto na
 * validação server-side (session-actions.ts) quanto no formulário
 * (appointment-panel.tsx), pra nunca divergir entre as duas pontas.
 */
export const CANCEL_REASONS = [
  { value: "doenca_crianca", label: "Doença da criança" },
  { value: "transporte", label: "Transporte" },
  { value: "esquecimento", label: "Esquecimento" },
  { value: "viagem", label: "Viagem" },
  { value: "sem_justificativa", label: "Sem justificativa" },
  { value: "terapeuta_indisponivel", label: "Terapeuta indisponível" },
  { value: "sala_indisponivel", label: "Sala indisponível" },
  { value: "clinica_fechada", label: "Clínica fechada" },
  { value: "outro", label: "Outro" },
] as const;

/**
 * Os 5 status negativos que a recepção pode aplicar a uma sessão ainda
 * agendada/confirmada (falta, os 3 tipos de cancelamento, remarcação).
 * `falta_familia` fica fora de CANCELLED_APPOINTMENT_STATUSES
 * (lib/patient-stage.ts) de propósito — aquela lista serve pra cálculo de
 * estágio do paciente, não pra esta UI.
 */
export const NEGATIVE_STATUSES = [
  { value: "falta_familia", label: "Falta da família" },
  { value: "cancelada_familia", label: "Cancelada pela família" },
  { value: "cancelada_terapeuta", label: "Cancelada pelo terapeuta" },
  { value: "cancelada_clinica", label: "Cancelada pela clínica" },
  { value: "remarcada", label: "Remarcada" },
] as const;
