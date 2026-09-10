// Mapeamento único de appointments.status -> rótulo/cor do design system
// (Broadsheet/FaçaAmigos). Reaproveitado por qualquer tela que
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
  aguardando_aprovacao_supervisao: { label: "Aprovação pendente", tagClass: "st-agendada", colorVar: "var(--status-agendada)" },
};

export const PLAN_GOAL_STATUS_STYLE: Record<string, { label: string; tagClass: string }> = {
  ativa: { label: "Ativa", tagClass: "st-em-atendimento" },
  atingida: { label: "Atingida", tagClass: "st-realizada" },
  suspensa: { label: "Suspensa", tagClass: "st-cancelada" },
};

export const AUTHORIZATION_STATUS_STYLE: Record<string, { label: string; tagClass: string }> = {
  pendente: { label: "Pendente", tagClass: "st-agendada" },
  ativa: { label: "Ativa", tagClass: "st-confirmada" },
  esgotada: { label: "Esgotada", tagClass: "st-falta" },
  vencida: { label: "Vencida", tagClass: "st-falta" },
  negada: { label: "Negada", tagClass: "st-cancelada" },
};

export const BILLING_ITEM_STATUS_STYLE: Record<string, { label: string; tagClass: string }> = {
  pendente: { label: "Pendente", tagClass: "st-agendada" },
  enviado: { label: "Enviada", tagClass: "st-em-atendimento" },
  pago: { label: "Paga", tagClass: "st-realizada" },
  glosado: { label: "Glosada", tagClass: "st-falta" },
  recursado: { label: "Em recurso", tagClass: "st-em-atendimento" },
  recuperado: { label: "Recuperada", tagClass: "st-confirmada" },
};

// Movidos de app/supervisao/grade-data.ts (que reexporta os quatro abaixo)
// para cá quando app/terapeuta/agenda passou a precisar da mesma
// classificação visual — evita import cruzado app/terapeuta/** -> app/supervisao/**.
export type AppointmentKind = "recorrente" | "avaliacao" | "provisoria" | "supervisao" | "reuniao_familia";

/**
 * O schema (PRD §7) não tem um "tipo de sessão" explícito — só booleans
 * (`is_evaluation`, `is_provisional`, `is_family_meeting`) e `discipline`
 * livre. O mock (Coordenador.dc.html) pinta 4 categorias; reconstruímos a 4ª
 * ("Supervisão", sem coluna própria) por convenção de nome de disciplina.
 * `is_family_meeting` é checado antes de `is_provisional` porque toda
 * reunião com responsável já nasce provisória (sem guia de convênio) — sem
 * essa ordem ela cairia na categoria genérica "Provisória · sem guia".
 */
export function classifyAppointmentKind(appointment: {
  isEvaluation: boolean;
  isProvisional: boolean;
  discipline: string;
  isFamilyMeeting?: boolean;
}): AppointmentKind {
  if (appointment.isEvaluation) return "avaliacao";
  if (appointment.isFamilyMeeting) return "reuniao_familia";
  if (appointment.isProvisional) return "provisoria";
  if (appointment.discipline.toLowerCase().includes("supervis")) return "supervisao";
  return "recorrente";
}

export const KIND_STYLE: Record<
  AppointmentKind,
  { label: string; bg: string; text: string; border: string; swatch: string; badge?: string }
> = {
  recorrente: {
    label: "Terapia recorrente",
    bg: "var(--color-accent-100)",
    text: "var(--color-ink)",
    border: "var(--color-divider)",
    swatch: "🟦",
  },
  avaliacao: {
    label: "Avaliação",
    bg: "var(--status-agendada-bg)",
    text: "var(--status-agendada)",
    border: "var(--status-agendada-border, #fcd34d)",
    swatch: "🟨",
  },
  provisoria: {
    label: "Provisória · sem guia",
    bg: "var(--status-falta-bg)",
    text: "#b91c1c",
    border: "#fca5a5",
    swatch: "🟥",
    badge: "Sem Guia",
  },
  supervisao: {
    label: "Supervisão",
    bg: "var(--color-neutral-200)",
    text: "var(--color-ink)",
    border: "var(--color-neutral-400, #cbd5e1)",
    swatch: "⬜",
  },
  reuniao_familia: {
    label: "Reunião · Responsável",
    bg: "var(--color-accent-2-100)",
    text: "var(--color-accent-2-700)",
    border: "var(--color-accent-2-300)",
    swatch: "🟪",
  },
};

// Statuses que não entram na grade "planejada" — cancelamento/remarcação já
// liberou o horário.
export const GRID_EXCLUDED_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "remarcada",
];
