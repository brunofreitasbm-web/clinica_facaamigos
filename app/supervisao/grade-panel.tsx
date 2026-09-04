"use client";

import { useMemo, useState } from "react";
import { WEEKDAY_LABEL, KIND_STYLE, type AppointmentKind } from "./grade-data";

export type GradeAppointment = {
  id: string;
  dayIndex: number; // 0=Seg .. 4=Sex
  timeLabel: string; // "09:00"
  patientName: string;
  therapistId: string;
  therapistName: string;
  roomId: string;
  roomName: string;
  kind: AppointmentKind;
};

export type PendingNote = {
  appointmentId: string;
  therapistName: string;
  patientName: string;
  hoursOverdue: number;
};

function AppointmentChip({ appt }: { appt: GradeAppointment }) {
  const style = KIND_STYLE[appt.kind];
  return (
    <div
      className="mb-1 rounded-sm px-2 py-1 text-[11px] leading-tight last:mb-0"
      style={{ background: style.bg, borderRadius: "var(--radius-sm)" }}
      title={`${style.label} · ${appt.timeLabel}`}
    >
      <div className="font-semibold">{appt.patientName}</div>
      <div className="opacity-75">{appt.timeLabel}</div>
    </div>
  );
}

export function GradePanel({
  weekLabel,
  weekNumber,
  activePatientsCount,
  dueReassessments,
  therapists,
  rooms,
  appointments,
  pendingNotes,
  carteira,
}: {
  weekLabel: string;
  weekNumber: number;
  activePatientsCount: number;
  dueReassessments: number;
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  appointments: GradeAppointment[];
  pendingNotes: PendingNote[];
  carteira: { sessionsInGrid: number; provisionalNoGuide: number; onTimePercent: number | null };
}) {
  const [mode, setMode] = useState<"terapeuta" | "sala">("terapeuta");

  const rows = useMemo(() => {
    const source = mode === "terapeuta" ? therapists : rooms;
    return source.map((entity) => ({
      id: entity.id,
      name: entity.name,
      days: Array.from({ length: 5 }, (_, dayIndex) =>
        appointments
          .filter((a) =>
            dayIndex === a.dayIndex && (mode === "terapeuta" ? a.therapistId === entity.id : a.roomId === entity.id),
          )
          .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel)),
      ),
    }));
  }, [mode, therapists, rooms, appointments]);

  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }}>
            Semana {weekNumber} · {weekLabel}
          </h6>
          <h1 className="m-0">Grade semanal</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {activePatientsCount} pacientes ativos · {dueReassessments} reavaliações a vencer
          </p>
        </div>
        <div className="seg">
          <label className="seg-opt">
            <input type="radio" name="grade-mode" checked={mode === "terapeuta"} onChange={() => setMode("terapeuta")} />
            Por terapeuta
          </label>
          <label className="seg-opt">
            <input type="radio" name="grade-mode" checked={mode === "sala"} onChange={() => setMode("sala")} />
            Por sala
          </label>
        </div>
        <button type="button" className="btn btn-primary" disabled title="Publicação de grade ainda não existe no schema (§7) — placeholder do mock.">
          Publicar grade
        </button>
      </div>

      <div className="overflow-x-auto rounded-md" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: "150px repeat(5, 1fr)" }}>
          <div className="border-b p-2" style={{ borderColor: "var(--color-divider)" }} />
          {WEEKDAY_LABEL.map((label) => (
            <div
              key={label}
              className="border-b p-2 text-xs font-medium uppercase tracking-wide text-ink-soft"
              style={{ borderColor: "var(--color-divider)" }}
            >
              {label}
            </div>
          ))}
          {rows.length === 0 && (
            <div className="col-span-6 p-6 text-sm text-ink-faint">
              {mode === "terapeuta" ? "Nenhum terapeuta cadastrado." : "Nenhuma sala cadastrada."}
            </div>
          )}
          {rows.map((row) => (
            <div key={row.id} className="contents">
              <div
                className="border-b p-2 text-sm font-medium"
                style={{ borderColor: "var(--color-divider)" }}
              >
                {row.name}
              </div>
              {row.days.map((dayAppointments, dayIndex) => (
                <div
                  key={dayIndex}
                  className="min-h-16 border-b p-1"
                  style={{ borderColor: "var(--color-divider)" }}
                >
                  {dayAppointments.map((appt) => (
                    <AppointmentChip key={appt.id} appt={appt} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-5 text-xs text-ink-soft">
        {(Object.keys(KIND_STYLE) as AppointmentKind[]).map((kind) => (
          <span key={kind}>
            {KIND_STYLE[kind].swatch} {KIND_STYLE[kind].label}
          </span>
        ))}
      </div>

      <div className="mt-14 grid grid-cols-1 gap-16 lg:grid-cols-2">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Pendências da equipe · evolução atrasada
          </h6>
          {pendingNotes.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhuma evolução atrasada — equipe em dia.</p>
          ) : (
            <div className="flex flex-col">
              {pendingNotes.map((p) => (
                <div
                  key={p.appointmentId}
                  className="flex items-center justify-between gap-3 border-b py-3 text-sm"
                  style={{ borderColor: "var(--color-divider)" }}
                >
                  <div>
                    <div className="font-medium">{p.therapistName}</div>
                    <div className="text-ink-soft">{p.patientName}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-figure" style={{ color: "var(--status-falta)" }}>
                      {p.hoursOverdue} h atrasada
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled
                      title="Sem canal de notificação pra equipe no schema (§7) — placeholder do mock."
                    >
                      Lembrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Carteira · esta semana
          </h6>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="tabular-figure text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                {carteira.sessionsInGrid}
              </div>
              <div className="text-xs text-ink-soft">Sessões na grade</div>
            </div>
            <div>
              <div
                className="tabular-figure text-3xl font-semibold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--status-falta)" }}
              >
                {carteira.provisionalNoGuide}
              </div>
              <div className="text-xs text-ink-soft">Provisórias · sem guia</div>
            </div>
            <div>
              <div
                className="tabular-figure text-3xl font-semibold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2)" }}
              >
                {carteira.onTimePercent === null ? "—" : `${carteira.onTimePercent}%`}
              </div>
              <div className="text-xs text-ink-soft">Evolução em 24h</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
