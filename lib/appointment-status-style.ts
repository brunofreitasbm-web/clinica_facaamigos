// Mapeamento único de appointments.status -> rótulo/cor do design system
// (Broadsheet/Instituto Faça Amigos). Reaproveitado por qualquer tela que
// precise pintar sessões pelo status: ficha do paciente, agenda, faturamento.
export const APPOINTMENT_STATUS_STYLE: Record<
  string,
  { label: string; tagClass: string; colorVar: string }
> = {
  agendada: { label: "A confirmar", tagClass: "st-agendada", colorVar: "var(--status-agendada)" },
  confirmada: { label: "Confirmada", tagClass: "st-confirmada", colorVar: "var(--status-confirmada)" },
  realizada: { label: "Realizada", tagClass: "st-realizada", colorVar: "var(--status-realizada)" },
  falta_familia: { label: "Falta", tagClass: "st-falta", colorVar: "var(--status-falta)" },
  cancelada_familia: { label: "Cancelada", tagClass: "st-cancelada", colorVar: "var(--status-cancelada)" },
  cancelada_terapeuta: { label: "Cancelada", tagClass: "st-cancelada", colorVar: "var(--status-cancelada)" },
  cancelada_clinica: { label: "Cancelada", tagClass: "st-cancelada", colorVar: "var(--status-cancelada)" },
  remarcada: { label: "Remarcada", tagClass: "st-cancelada", colorVar: "var(--status-cancelada)" },
};

export const PLAN_GOAL_STATUS_STYLE: Record<string, { label: string; tagClass: string }> = {
  ativa: { label: "Ativa", tagClass: "st-em-atendimento" },
  atingida: { label: "Atingida", tagClass: "st-realizada" },
  suspensa: { label: "Suspensa", tagClass: "st-cancelada" },
};

export const BILLING_ITEM_STATUS_STYLE: Record<string, { label: string; tagClass: string }> = {
  pendente: { label: "Pendente", tagClass: "st-agendada" },
  enviado: { label: "Enviada", tagClass: "st-em-atendimento" },
  pago: { label: "Paga", tagClass: "st-realizada" },
  glosado: { label: "Glosada", tagClass: "st-falta" },
  recursado: { label: "Em recurso", tagClass: "st-em-atendimento" },
  recuperado: { label: "Recuperada", tagClass: "st-confirmada" },
};
