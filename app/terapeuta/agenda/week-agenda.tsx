import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone, civilTimeInTimeZone } from "@/lib/timezone";
import { classifyAppointmentKind, KIND_STYLE, GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";
import type { WeekGrid } from "@/lib/calendar-grid";

export type WeekAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  discipline: string;
  startsAt: string;
  endsAt: string;
  status: string;
  isEvaluation: boolean;
  isProvisional: boolean;
};

const WEEKDAY_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
/** Seg–Sex fecha às 19h, Sáb só de manhã até 12h — mesma referência de app/supervisao/evaluation-calendar.tsx. */
const CLOSING_HOUR_BY_DAY = [19, 19, 19, 19, 19, 12];
const DAY_START_HOUR = 8;
const GRID_END_HOUR = 19;
const TOTAL_MINUTES = (GRID_END_HOUR - DAY_START_HOUR) * 60;
const ROW_MINUTES = 30;
const ROW_HEIGHT_PX = 28;
const COLUMN_HEIGHT_PX = (TOTAL_MINUTES / ROW_MINUTES) * ROW_HEIGHT_PX;
const HOUR_MARKS = Array.from({ length: GRID_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function targetHref(a: WeekAppointment) {
  return a.status === "realizada"
    ? `/terapeuta/evolucao/${a.id}?voltar=agenda`
    : `/terapeuta/paciente/${a.patientId}`;
}

/**
 * Visão semanal (Seg–Sáb) da agenda do terapeuta. Sem drag-and-drop e sem
 * criação/reagendamento — isso é papel da Recepção (app/recepcao/agenda/**).
 * Duas renderizações dos mesmos dados: lista empilhada por dia no mobile
 * (default, evita espremer 6 colunas em 390px) e grade horária a partir de
 * `sm:`, com o mesmo desenho de app/supervisao/evaluation-calendar.tsx.
 */
export function WeekAgenda({ week, appointments }: { week: WeekGrid; appointments: WeekAppointment[] }) {
  const visible = appointments.filter((a) => !GRID_EXCLUDED_STATUSES.includes(a.status));
  const excluded = appointments.filter((a) => GRID_EXCLUDED_STATUSES.includes(a.status));

  const byDay = new Map<string, WeekAppointment[]>();
  for (const day of week.days) byDay.set(day, []);
  for (const a of visible) {
    const day = civilDateInTimeZone(new Date(a.startsAt), CLINIC_TIMEZONE);
    byDay.get(day)?.push(a);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: seções empilhadas por dia. */}
      <div className="flex flex-col gap-5 sm:hidden">
        {week.days.map((day, dayIndex) => {
          const dayAppointments = (byDay.get(day) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <section key={day}>
              <div className="mb-2 flex items-baseline justify-between">
                <h6 style={{ color: "var(--color-accent-2-600)" }}>
                  {WEEKDAY_LABEL[dayIndex]} · {day.split("-").reverse().slice(0, 2).join("/")}
                </h6>
                <span className="text-xs text-ink-faint">
                  {dayAppointments.length === 0
                    ? "sem sessões"
                    : `${dayAppointments.length} sessão${dayAppointments.length === 1 ? "" : "ões"}`}
                </span>
              </div>
              {dayAppointments.length === 0 ? (
                <p className="text-xs text-ink-faint">—</p>
              ) : (
                <div className="flex flex-col">
                  {dayAppointments.map((a) => {
                    const kind = classifyAppointmentKind(a);
                    const style = KIND_STYLE[kind];
                    return (
                      <Link
                        key={a.id}
                        href={targetHref(a)}
                        className="flex items-center justify-between gap-3 border-b py-2.5 no-underline"
                        style={{ borderColor: "var(--color-divider)" }}
                      >
                        <span className="text-sm font-semibold text-ink">
                          {civilTimeInTimeZone(a.startsAt, CLINIC_TIMEZONE)}
                        </span>
                        <span className="flex-1 truncate px-2 text-sm">{a.patientName}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {style.swatch} {style.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* sm+: grade horária. */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="flex" style={{ minWidth: 760 }}>
          <div className="w-14 shrink-0 pt-6">
            {HOUR_MARKS.map((h) => (
              <div key={h} style={{ height: ROW_HEIGHT_PX * (60 / ROW_MINUTES) }} className="text-right text-[11px] text-ink-faint md:text-xs">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {week.days.map((day, dayIndex) => {
            const dayAppointments = byDay.get(day) ?? [];
            const closingHour = CLOSING_HOUR_BY_DAY[dayIndex];
            const closedFromMinutes = (closingHour - DAY_START_HOUR) * 60;
            const closedTop = (closedFromMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
            const closedHeight = COLUMN_HEIGHT_PX - closedTop;
            return (
              <div key={day} className="flex-1 border-l pl-1" style={{ borderColor: "var(--color-divider)" }}>
                <div className="pb-1 text-center text-xs font-bold text-ink md:text-sm">
                  {WEEKDAY_LABEL[dayIndex]} {day.split("-")[2]}
                </div>
                <div
                  className="relative rounded-md"
                  style={{ height: COLUMN_HEIGHT_PX, background: "var(--color-bg)" }}
                >
                  {Array.from({ length: TOTAL_MINUTES / 60 }, (_, i) => (
                    <div key={i} className="border-t" style={{ height: ROW_HEIGHT_PX * (60 / ROW_MINUTES), borderColor: "var(--color-divider)" }} />
                  ))}
                  {closedHeight > 0 && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 flex items-start justify-center rounded-b-md pt-1 text-[10px] font-semibold text-ink-faint md:text-xs"
                      style={{
                        top: closedTop,
                        height: closedHeight,
                        background:
                          "repeating-linear-gradient(45deg, var(--color-neutral-200), var(--color-neutral-200) 6px, transparent 6px, transparent 12px)",
                      }}
                    >
                      Fechado
                    </div>
                  )}
                  {dayAppointments.map((a) => {
                    const startMinutes =
                      parseTimeToMinutes(civilTimeInTimeZone(a.startsAt, CLINIC_TIMEZONE)) - DAY_START_HOUR * 60;
                    const durationMinutes = Math.max(30, (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000);
                    const top = (startMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                    const height = (durationMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                    const kind = classifyAppointmentKind(a);
                    const style = KIND_STYLE[kind];
                    return (
                      <Link
                        key={a.id}
                        href={targetHref(a)}
                        className="absolute left-0.5 right-0.5 overflow-hidden rounded-md border p-1 text-[11px] no-underline shadow-sm md:p-1.5 md:text-xs"
                        style={{ top, height, background: style.bg, borderColor: style.border, color: style.text }}
                        title={`${a.patientName} · ${a.discipline}`}
                      >
                        <p className="truncate font-semibold">{a.patientName}</p>
                        <p className="truncate opacity-80">{civilTimeInTimeZone(a.startsAt, CLINIC_TIMEZONE)}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {excluded.length > 0 && (
        <p className="text-xs text-ink-faint">
          {excluded.length} sessão{excluded.length === 1 ? "" : "ões"} cancelada{excluded.length === 1 ? "" : "s"}/remarcada{excluded.length === 1 ? "" : "s"} nesta semana.
        </p>
      )}
    </div>
  );
}
