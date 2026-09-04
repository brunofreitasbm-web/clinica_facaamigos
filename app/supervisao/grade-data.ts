// Helpers só usados pela aba "Grade" do painel de supervisão — cálculo de
// semana civil (Seg–Sex) e classificação visual de sessões. Ficam locais a
// `app/supervisao/**` (não em lib/) porque não há outra tela que precise de
// grade semanal por enquanto; `app/recepcao/agenda/day-grid.tsx` resolve o
// caso de "um dia, várias salas" com sua própria lógica mais simples.

/** `YYYY-MM-DD` + `n` dias corridos, aritmética de calendário pura (sem fuso). */
function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + n));
  return next.toISOString().slice(0, 10);
}

/** Segunda-feira (`YYYY-MM-DD`) da semana civil que contém `dateStr`. */
function mondayOf(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay(); // 0=dom..6=sáb
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diffToMonday);
}

/** Número da semana ISO-8601 pro dia informado. */
function isoWeekNumber(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Seg=0..Dom=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // quinta-feira desta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

function shortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export const WEEKDAY_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;

export type WeekInfo = {
  /** `YYYY-MM-DD` de Segunda a Sexta desta semana. */
  days: string[];
  weekNumber: number;
  rangeLabel: string;
};

/** Semana civil (Seg–Sex) que contém `todayStr` (`YYYY-MM-DD`). */
export function currentWeek(todayStr: string): WeekInfo {
  const monday = mondayOf(todayStr);
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  return {
    days,
    weekNumber: isoWeekNumber(monday),
    rangeLabel: `${shortDate(days[0])} – ${shortDate(days[4])}`,
  };
}

/** Início (Seg 00:00) e fim exclusivo (Sáb 00:00) da semana, em `YYYY-MM-DD`. */
export function weekBounds(week: WeekInfo): { start: string; end: string } {
  return { start: week.days[0], end: addDays(week.days[4], 1) };
}

export type AppointmentKind = "recorrente" | "avaliacao" | "provisoria" | "supervisao";

/**
 * O schema (PRD §7) não tem um "tipo de sessão" explícito — só booleans
 * (`is_evaluation`, `is_provisional`) e `discipline` livre. O mock
 * (Coordenador.dc.html) pinta 4 categorias; reconstruímos a 4ª
 * ("Supervisão", sem coluna própria) por convenção de nome de disciplina.
 */
export function classifyAppointmentKind(appointment: {
  isEvaluation: boolean;
  isProvisional: boolean;
  discipline: string;
}): AppointmentKind {
  if (appointment.isEvaluation) return "avaliacao";
  if (appointment.isProvisional) return "provisoria";
  if (appointment.discipline.toLowerCase().includes("supervis")) return "supervisao";
  return "recorrente";
}

export const KIND_STYLE: Record<AppointmentKind, { label: string; bg: string; swatch: string }> = {
  recorrente: { label: "Terapia recorrente", bg: "var(--color-accent-100)", swatch: "🟦" },
  avaliacao: { label: "Avaliação", bg: "var(--status-agendada-bg)", swatch: "🟨" },
  provisoria: { label: "Provisória · sem guia", bg: "var(--status-falta-bg)", swatch: "🟥" },
  supervisao: { label: "Supervisão", bg: "var(--color-neutral-200)", swatch: "⬜" },
};

// Statuses que não entram na grade "planejada" — cancelamento/remarcação já
// liberou o horário.
export const GRID_EXCLUDED_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "remarcada",
];

/** "HH:mm" de um instante ISO, no fuso da clínica. */
export function timeLabel(isoInstant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoInstant));
}

/** Índice (0=Seg..4=Sex) do dia da semana `week` em que `isoInstant` cai, ou -1 se for fim de semana / fora da semana. */
export function dayIndexInWeek(isoInstant: string, week: WeekInfo, timeZone: string): number {
  const civilDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoInstant));
  return week.days.indexOf(civilDate);
}
