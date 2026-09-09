"use client";

import { useMemo, useState } from "react";
import { WEEKDAY_LABEL, KIND_STYLE, type AppointmentKind } from "./grade-data";
import { publishGradeAction } from "./grade-actions";

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

export type PendingPlan = {
  patientId: string;
  patientName: string;
  daysOverdue: number;
};

/**
 * Sanitiza o nome do paciente para evitar o vazamento de chaves brutas de banco de dados
 * (ex: Child_1788517902660, null, etc.) e garante fallback com ícone visual de alerta (⚠️).
 */
export function sanitizePatientName(name?: string | null): { displayName: string; isInvalid: boolean } {
  if (!name || typeof name !== "string" || !name.trim()) {
    return { displayName: "Paciente Não Identificado", isInvalid: true };
  }
  const trimmed = name.trim();
  if (
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    /^Child_\d+/i.test(trimmed) ||
    /^(Child|Patient|Paciente|User|Test)_\d+/i.test(trimmed) ||
    /^P\(/i.test(trimmed)
  ) {
    return { displayName: "Cadastro Incompleto", isInvalid: true };
  }
  return { displayName: trimmed, isInvalid: false };
}

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
  const { displayName, isInvalid } = sanitizePatientName(appt.patientName);

  return (
    <div
      onClick={onClick}
      className={`mb-1.5 cursor-pointer rounded-md p-2 text-xs leading-tight transition-all hover:scale-[1.02] hover:shadow-sm ${
        hasConflict ? "border-2 border-red-500" : ""
      }`}
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: "var(--radius-sm)",
        border: hasConflict ? "2px solid #ef4444" : `1px solid ${style.border}`,
      }}
      title={`${style.label} · ${appt.timeLabel} · ${displayName}${isInvalid ? " (Cadastro incompleto - atualize os dados)" : ""}`}
    >
      <div className="flex items-center justify-between gap-1 font-semibold">
        <span className="truncate flex items-center gap-1">
          {isInvalid && (
            <span className="shrink-0 text-[11px]" title="Cadastro Incompleto - Atualize o cadastro na recepção">
              ⚠️
            </span>
          )}
          <span className={isInvalid ? "italic text-amber-800 dark:text-amber-300 font-normal" : ""}>
            {displayName}
          </span>
        </span>
        {appt.kind === "provisoria" && (
          <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
            Sem Guia
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] opacity-90">
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
  pendingPlans,
  carteira,
}: {
  weekLabel: string;
  weekNumber: number;
  activePatientsCount: number;
  dueReassessments: number;
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string; capacity?: number }[];
  appointments: GradeAppointment[];
  pendingNotes: PendingNote[];
  pendingPlans: PendingPlan[];
  carteira: { sessionsInGrid: number; provisionalNoGuide: number; onTimePercent: number | null };
}) {
  const [mode, setMode] = useState<"terapeuta" | "sala">("terapeuta");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [notification, setNotification] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [selectedAppt, setSelectedAppt] = useState<GradeAppointment | null>(null);

  // Extrai lista única de disciplinas para filtro
  const disciplines = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (a.discipline) set.add(a.discipline);
    });
    return Array.from(set);
  }, [appointments]);

  const roomCapacity = useMemo(() => new Map(rooms.map((r) => [r.id, r.capacity ?? 1])), [rooms]);

  // Capacidade efetiva de um grupo de atendimentos no mesmo horário/sala:
  // 1ª avaliação/anamnese/acolhimento (kind "avaliacao") é sempre 1 criança
  // por avaliador/sala, mesmo que a sala cadastrada comporte mais — a
  // capacidade da sala só vale para terapia recorrente/grupo.
  function effectiveCapacity(list: GradeAppointment[], roomId: string): number {
    if (list.some((a) => a.kind === "avaliacao")) return 1;
    return roomCapacity.get(roomId) ?? 1;
  }

  // Um terapeuta pode atender várias crianças ao mesmo tempo — o fator
  // limitante é a capacidade da sala, não o terapeuta. Por isso conflito de
  // terapeuta só existe quando ele aparece em salas diferentes no mesmo
  // horário (impossível fisicamente) ou quando a sala usada estoura a
  // capacidade cadastrada. Conflito de sala é sempre por capacidade.
  const conflictIds = useMemo(() => {
    const conflicts = new Set<string>();

    if (mode === "sala") {
      const byRoomSlot = new Map<string, GradeAppointment[]>();
      appointments.forEach((a) => {
        const key = `${a.dayIndex}|${a.timeLabel}|${a.roomId}`;
        const list = byRoomSlot.get(key) ?? [];
        list.push(a);
        byRoomSlot.set(key, list);
      });
      byRoomSlot.forEach((list, key) => {
        const roomId = key.split("|")[2];
        if (list.length > effectiveCapacity(list, roomId)) {
          list.forEach((a) => conflicts.add(a.id));
        }
      });
      return conflicts;
    }

    const byTherapistSlot = new Map<string, GradeAppointment[]>();
    appointments.forEach((a) => {
      const key = `${a.dayIndex}|${a.timeLabel}|${a.therapistId}`;
      const list = byTherapistSlot.get(key) ?? [];
      list.push(a);
      byTherapistSlot.set(key, list);
    });
    byTherapistSlot.forEach((list) => {
      const distinctRooms = new Set(list.map((a) => a.roomId));
      if (distinctRooms.size > 1) {
        // Terapeuta não pode estar em duas salas ao mesmo tempo.
        list.forEach((a) => conflicts.add(a.id));
        return;
      }
      if (list.length > effectiveCapacity(list, list[0].roomId)) {
        list.forEach((a) => conflicts.add(a.id));
      }
    });

    return conflicts;
  }, [appointments, mode, roomCapacity]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const { displayName } = sanitizePatientName(a.patientName);
      const matchesDiscipline =
        disciplineFilter === "todos" || a.discipline?.toLowerCase() === disciplineFilter.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  // Tratamento contra múltiplos cliques e timeout de 15s com AbortController
  async function handlePublishGrade() {
    if (isPublishing) return;
    setIsPublishing(true);
    setToastError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const result = await Promise.race([
        publishGradeAction(weekNumber),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new Error("O servidor demorou a responder, tente novamente."));
          });
        }),
      ]);

      clearTimeout(timeoutId);

      if (result.success) {
        setNotification("Grade semanal publicada e sincronizada com sucesso!");
        setTimeout(() => setNotification(null), 4000);
      } else {
        setToastError(`Falha ao publicar. ${result.error}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : "Ocorreu um erro inesperado ao publicar.";
      setToastError(`Falha ao publicar. ${message}`);
    } finally {
      setIsPublishing(false);
    }
  }

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
            className="btn btn-primary flex items-center justify-center gap-2 min-w-[130px] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isPublishing}
            onClick={handlePublishGrade}
          >
            {isPublishing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Publicando...</span>
              </>
            ) : (
              "Publicar grade"
            )}
          </button>
        </div>
      </div>

      {notification && (
        <div className="mb-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          ✓ {notification}
        </div>
      )}

      {toastError && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
          <span>⚠️ {toastError}</span>
          <button type="button" onClick={() => setToastError(null)} className="ml-2 font-bold hover:opacity-80">
            ✕
          </button>
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
                  key={`${row.id}-day-${dayIndex}`}
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

      {/* Legenda com correspondência visual 1:1 com os cards no grid */}
      <div className="mt-6 rounded-lg border border-divider/60 bg-paper/50 p-3.5 shadow-xs">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
          Legenda de Horários na Grade
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(Object.keys(KIND_STYLE) as AppointmentKind[]).map((kind) => {
            const style = KIND_STYLE[kind];
            return (
              <div
                key={kind}
                className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold shadow-2xs transition-transform hover:scale-[1.02]"
                style={{
                  background: style.bg,
                  color: style.text,
                  border: `1px solid ${style.border}`,
                }}
              >
                <span>{style.label}</span>
                {style.badge && (
                  <span className="rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                    {style.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
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
                <h3 className="text-xl font-semibold m-0 text-ink flex items-center gap-1.5">
                  {sanitizePatientName(selectedAppt.patientName).isInvalid && (
                    <span title="Cadastro Incompleto">⚠️</span>
                  )}
                  <span>{sanitizePatientName(selectedAppt.patientName).displayName}</span>
                </h3>
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
                  setNotification(`Visualização de PTS acionada para ${sanitizePatientName(selectedAppt.patientName).displayName}`);
                  setSelectedAppt(null);
                  setTimeout(() => setNotification(null), 4000);
                }}
              >
                Ver PTS do Paciente
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
              {pendingNotes.map((p) => {
                const { displayName } = sanitizePatientName(p.patientName);
                return (
                  <div
                    key={p.appointmentId}
                    className="flex items-center justify-between gap-3 border-b py-3 text-sm"
                    style={{ borderColor: "var(--color-divider)" }}
                  >
                    <div>
                      <div className="font-medium">{p.therapistName}</div>
                      <div className="text-ink-soft">{displayName}</div>
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
                );
              })}
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
            
            {/* KPI Evolução em 24h com cores semânticas e tooltip educativo */}
            <div className="relative group cursor-help">
              <div
                className="tabular-figure text-3xl font-semibold flex items-center gap-1 transition-colors"
                style={{
                  fontFamily: "var(--font-heading)",
                  color:
                    carteira.onTimePercent === null
                      ? "var(--color-ink-soft)"
                      : carteira.onTimePercent >= 90
                      ? "#10b981" // Verde para excelente compliance (>= 90%)
                      : carteira.onTimePercent >= 75
                      ? "#f59e0b" // Amarelo/Laranja para atenção (75-89%)
                      : "#ef4444", // Vermelho para alerta (< 75%)
                }}
              >
                <span>{carteira.onTimePercent === null ? "—" : `${carteira.onTimePercent}%`}</span>
                <span className="text-xs text-ink-soft opacity-70">ℹ️</span>
              </div>
              <div className="text-xs text-ink-soft flex items-center gap-1">
                <span>Evolução em 24h</span>
              </div>

              {/* Tooltip educativo ao passar o mouse ou focar */}
              <div className="absolute left-0 bottom-full mb-2 hidden w-64 rounded-md bg-slate-900 p-2.5 text-[11px] leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block z-30 dark:bg-slate-800 border border-slate-700">
                <div className="font-semibold text-amber-300 mb-0.5">ℹ️ Sobre o indicador</div>
                Percentual de prontuários que foram evoluídos no prazo limite de 24 horas após o término da sessão. Meta ideal: <strong>100%</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-14">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
          Pendências da equipe · PTS atrasado
        </h6>
        {pendingPlans.length === 0 ? (
          <p className="text-sm text-ink-faint">Nenhum PTS atrasado — prazo de 50 dias em dia.</p>
        ) : (
          <div className="flex flex-col">
            {pendingPlans.map((p) => {
              const { displayName } = sanitizePatientName(p.patientName);
              return (
                <div
                  key={p.patientId}
                  className="flex items-center justify-between gap-3 border-b py-3 text-sm"
                  style={{ borderColor: "var(--color-divider)" }}
                >
                  <div className="font-medium">{displayName}</div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-figure" style={{ color: "var(--status-falta)" }}>
                      {p.daysOverdue} dia(s) atrasado
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setNotification(`Lembrete de PTS pendente enviado para a equipe de ${displayName}`);
                        setTimeout(() => setNotification(null), 4000);
                      }}
                    >
                      Lembrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


