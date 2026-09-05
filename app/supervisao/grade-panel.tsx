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
  discipline?: string;
  hasGuide?: boolean;
};

export type PendingNote = {
  appointmentId: string;
  therapistName: string;
  patientName: string;
  hoursOverdue: number;
};

function AppointmentChip({
  appt,
  onClick,
  hasConflict,
}: {
  appt: GradeAppointment;
  onClick: () => void;
  hasConflict?: boolean;
}) {
  const style = KIND_STYLE[appt.kind];
  return (
    <div
      onClick={onClick}
      className={`mb-1.5 cursor-pointer rounded-md p-2 text-xs leading-tight transition-all hover:scale-[1.02] hover:shadow-sm ${
        hasConflict ? "border-2 border-red-500" : ""
      }`}
      style={{
        background: style.bg,
        borderRadius: "var(--radius-sm)",
        border: hasConflict ? "2 border-red-500" : "1px solid var(--color-divider)",
      }}
      title={`${style.label} · ${appt.timeLabel} · Clique para detalhes`}
    >
      <div className="flex items-center justify-between gap-1 font-semibold text-ink">
        <span className="truncate">{appt.patientName}</span>
        {appt.kind === "provisoria" && (
          <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700">
            Sem Guia
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-soft">
        <span>{appt.timeLabel}</span>
        <span className="truncate opacity-80">{appt.discipline ?? appt.therapistName}</span>
      </div>
      {hasConflict && (
        <div className="mt-1 font-bold text-red-600 text-[10px]">⚠️ Conflito de Horário</div>
      )}
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
  const [disciplineFilter, setDisciplineFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<GradeAppointment | null>(null);

  // Extrai lista única de disciplinas para filtro
  const disciplines = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (a.discipline) set.add(a.discipline);
    });
    return Array.from(set);
  }, [appointments]);

  // Identificação simples de conflitos (mesmo terapeuta/sala e mesmo horário/dia)
  const conflictIds = useMemo(() => {
    const map = new Map<string, string[]>();
    const conflicts = new Set<string>();

    appointments.forEach((a) => {
      const key = `${a.dayIndex}-${a.timeLabel}-${mode === "terapeuta" ? a.therapistId : a.roomId}`;
      const list = map.get(key) || [];
      list.push(a.id);
      map.set(key, list);
    });

    map.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach((id) => conflicts.add(id));
      }
    });

    return conflicts;
  }, [appointments, mode]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const matchesDiscipline =
        disciplineFilter === "todos" || a.discipline?.toLowerCase() === disciplineFilter.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.therapistName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.roomName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDiscipline && matchesSearch;
    });
  }, [appointments, disciplineFilter, searchTerm]);

  const rows = useMemo(() => {
    const source = mode === "terapeuta" ? therapists : rooms;
    return source.map((entity) => ({
      id: entity.id,
      name: entity.name,
      days: Array.from({ length: 5 }, (_, dayIndex) =>
        filteredAppointments
          .filter((a) =>
            dayIndex === a.dayIndex && (mode === "terapeuta" ? a.therapistId === entity.id : a.roomId === entity.id),
          )
          .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel)),
      ),
    }));
  }, [mode, therapists, rooms, filteredAppointments]);

  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }}>
            Semana {weekNumber} · {weekLabel}
          </h6>
          <h1 className="m-0">Grade semanal de supervisão</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {activePatientsCount} pacientes ativos · {dueReassessments} reavaliações a vencer
            {conflictIds.size > 0 && (
              <span className="ml-2 font-bold text-red-600">
                · ⚠️ {conflictIds.size} alertas de conflito
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar paciente ou terapeuta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-48 text-xs"
          />

          {disciplines.length > 0 && (
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="input w-36 text-xs"
            >
              <option value="todos">Todas disciplinas</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          <div className="seg">
            <label className="seg-opt">
              <input
                type="radio"
                name="grade-mode"
                checked={mode === "terapeuta"}
                onChange={() => setMode("terapeuta")}
              />
              Por terapeuta
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name="grade-mode"
                checked={mode === "sala"}
                onChange={() => setMode("sala")}
              />
              Por sala
            </label>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setNotification("Grade semanal publicada e sincronizada com sucesso!");
              setTimeout(() => setNotification(null), 4000);
            }}
          >
            Publicar grade
          </button>
        </div>
      </div>

      {notification && (
        <div className="mb-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          ✓ {notification}
        </div>
      )}

      <div className="overflow-x-auto rounded-md" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: "160px repeat(5, 1fr)" }}>
          <div className="border-b p-2 font-semibold text-xs text-ink-soft uppercase" style={{ borderColor: "var(--color-divider)" }}>
            {mode === "terapeuta" ? "Terapeuta" : "Sala"}
          </div>
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
                className="border-b p-2 text-sm font-medium flex items-center"
                style={{ borderColor: "var(--color-divider)" }}
              >
                {row.name}
              </div>
              {row.days.map((dayAppointments, dayIndex) => (
                <div
                  key={dayIndex}
                  className="min-h-20 border-b p-1 bg-paper/30 hover:bg-paper/80 transition-colors"
                  style={{ borderColor: "var(--color-divider)" }}
                >
                  {dayAppointments.map((appt) => (
                    <AppointmentChip
                      key={appt.id}
                      appt={appt}
                      hasConflict={conflictIds.has(appt.id)}
                      onClick={() => setSelectedAppt(appt)}
                    />
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

      {/* Modal de Inspeção de Agendamento */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between border-b pb-3 mb-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-ink-soft font-semibold">
                  Detalhes da Sessão · {selectedAppt.timeLabel}
                </span>
                <h3 className="text-xl font-semibold m-0 text-ink">{selectedAppt.patientName}</h3>
              </div>
              <button
                onClick={() => setSelectedAppt(null)}
                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-ink-soft">Terapeuta:</span>
                <span className="font-medium text-ink">{selectedAppt.therapistName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-ink-soft">Sala:</span>
                <span className="font-medium text-ink">{selectedAppt.roomName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-ink-soft">Tipo:</span>
                <span className="font-medium text-ink">{KIND_STYLE[selectedAppt.kind].label}</span>
              </div>
              {selectedAppt.discipline && (
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-ink-soft">Disciplina:</span>
                  <span className="font-medium text-ink">{selectedAppt.discipline}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-ink-soft">Status de Guia:</span>
                <span className={`font-semibold ${selectedAppt.kind === "provisoria" ? "text-red-600" : "text-emerald-600"}`}>
                  {selectedAppt.kind === "provisoria" ? "⚠️ Provisória · Sem Guia Autorizada" : "✓ Guia Vigente OK"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setSelectedAppt(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={() => {
                  setNotification(`Visualização de PEI acionada para ${selectedAppt.patientName}`);
                  setSelectedAppt(null);
                  setTimeout(() => setNotification(null), 4000);
                }}
              >
                Ver PEI do Paciente
              </button>
            </div>
          </div>
        </div>
      )}

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
                      onClick={() => {
                        setNotification(`Lembrete de evolução pendente enviado para ${p.therapistName}`);
                        setTimeout(() => setNotification(null), 4000);
                      }}
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

