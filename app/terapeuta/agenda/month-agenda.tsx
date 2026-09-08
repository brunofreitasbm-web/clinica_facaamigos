import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone } from "@/lib/timezone";
import { classifyAppointmentKind, KIND_STYLE, GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";
import type { MonthGrid } from "@/lib/calendar-grid";

export type MonthAppointment = {
  id: string;
  patientName: string;
  startsAt: string;
  status: string;
  isEvaluation: boolean;
  isProvisional: boolean;
  discipline: string;
};

const WEEKDAY_HEADER = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/**
 * Visão mensal: mapa de densidade, não grade horária — célula inteira é um
 * link pra `?view=dia&date=`. Sem matemática de hora de propósito (ver plano):
 * o mês responde "quantas sessões eu tenho nesse dia", a grade horária fica
 * pra semana/dia.
 */
export function MonthAgenda({
  grid,
  appointments,
  todayIso,
  therapistParam,
}: {
  grid: MonthGrid;
  appointments: MonthAppointment[];
  todayIso: string;
  therapistParam: string;
}) {
  const visible = appointments.filter((a) => !GRID_EXCLUDED_STATUSES.includes(a.status));
  const byDay = new Map<string, MonthAppointment[]>();
  for (const a of visible) {
    const day = civilDateInTimeZone(new Date(a.startsAt), CLINIC_TIMEZONE);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(a);
  }

  const qs = therapistParam ? `&therapist=${therapistParam}` : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-faint">
        {WEEKDAY_HEADER.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.cells.map((cell) => {
          const dayAppointments = (byDay.get(cell.iso) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          const isToday = cell.iso === todayIso;
          return (
            <Link
              key={cell.iso}
              href={`/terapeuta/agenda?view=dia&date=${cell.iso}${qs}`}
              className="flex min-h-[72px] flex-col gap-1 rounded-md border p-1.5 no-underline sm:min-h-[92px] md:min-h-[110px] md:p-2"
              style={{
                borderColor: isToday ? "var(--color-accent)" : "var(--color-divider)",
                borderWidth: isToday ? 2 : 1,
                background: cell.inMonth ? "#fff" : "var(--color-bg)",
                opacity: cell.inMonth ? 1 : 0.55,
              }}
            >
              <span className="text-xs font-semibold text-ink">{cell.day}</span>
              <div className="flex flex-col gap-0.5">
                {dayAppointments.slice(0, 2).map((a) => {
                  const kind = classifyAppointmentKind(a);
                  const style = KIND_STYLE[kind];
                  return (
                    <span
                      key={a.id}
                      className="truncate rounded px-1 text-[10px] font-medium"
                      style={{ background: style.bg, color: style.text }}
                      title={a.patientName}
                    >
                      {a.patientName.split(" ")[0]}
                    </span>
                  );
                })}
                {dayAppointments.length > 2 && (
                  <span className="text-[10px] text-ink-faint">+{dayAppointments.length - 2}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
