"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { User, PenLine, CalendarClock, X, Clock, CheckCircle2, UserCheck, XCircle, MessageCircle, AlertCircle, FileText, Plus, ShieldAlert, Search, Printer } from "lucide-react";
import { GuiaQuickActionModal } from "./guia-quick-action-modal";
import { ChegadaAvaliacaoModal } from "./chegada-avaliacao-modal";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

import {
  confirmAppointment,
  setAguardando,
  checkIn,
  checkOut,
  markMissedOrCancelled,
  undoAutoFalta,
  linkAuthorizationToAppointment,
  getPatientActiveAuthorizations,
  type PatientAuthorizationOption,
} from "./agenda/session-actions";
import { ReagendamentoDialog } from "./agenda/reagendamento-dialog";
import { getCheckinCoupon } from "./agenda/coupon-actions";
import { printCoupon } from "@/lib/print-coupon";
import { computeAppointmentUiState, UI_STATE_LABEL, type AppointmentUiState } from "@/lib/appointment-ui-state";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilTimeInTimeZone } from "@/lib/timezone";
import { PatientFormattedDisplay, PatientStatusBadge } from "@/components/patient-formatted-display";

export type TodaySession = {
  id: string;
  patientId: string;
  therapistId: string;
  roomId: string;
  appointmentTypeId: string | null;
  patientName: string;
  discipline: string;
  therapistName: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  checkinAt: string | null;
  attendanceStartedAt: string | null;
  checkoutAt: string | null;
  /** true quando status/checkout foram definidos por auto_resolve_appointments (pg_cron), não por um clique. */
  autoMarked: boolean;
  /** Sessão `realizada` sem session_notes assinada ainda — ver session_note_pending (RPC). */
  pendingNote: boolean;
  authorizationId: string | null;
  isProvisional: boolean;
  isEvaluation: boolean;
};

export type GuardianContact = {
  fullName: string;
  phone: string;
  relationship: string | null;
  isEmergencyContact: boolean;
};

type FilterKey = "todas" | "aConfirmar" | "emAtendimento" | "faltas";
type GroupMode = "lista" | "profissional" | "sala";

const GRID_HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08h–19h
const GRID_MINUTES = [0, 30];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

function durationLabel(startsAt: string, endsAt: string): string {
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  return `${minutes}min`;
}

function uiStateOf(s: TodaySession): AppointmentUiState {
  return computeAppointmentUiState(s);
}

function statusDisplay(s: TodaySession): { label: string; tagClass: string } {
  if (s.status === "agendada" || s.status === "confirmada") {
    const state = uiStateOf(s);
    return { label: UI_STATE_LABEL[state], tagClass: APPOINTMENT_STATUS_STYLE[s.status]?.tagClass ?? "st-agendada" };
  }
  const style = APPOINTMENT_STATUS_STYLE[s.status];
  return { label: style?.label ?? s.status, tagClass: style?.tagClass ?? "st-cancelada" };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function TodayAgendaList({
  sessions,
  rooms,
  appointmentTypes,
  guardiansByPatient,
  tagsByPatient,
}: {
  sessions: TodaySession[];
  rooms: { id: string; name: string }[];
  appointmentTypes: { id: string; name: string; durationMinutes: number }[];
  guardiansByPatient: Record<string, GuardianContact[]>;
  tagsByPatient: Record<string, string[]>;
}) {
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 350);
  const [groupMode, setGroupMode] = useState<GroupMode>("lista");
  const [selectedRoomSessionId, setSelectedRoomSessionId] = useState<string | null>(null);

  const [showGuiaModal, setShowGuiaModal] = useState(false);
  const [modalPatient, setModalPatient] = useState<{ id: string; name: string; appointmentId?: string } | null>(null);

  const [selectedTherapistIds, setSelectedTherapistIds] = useState<Set<string>>(new Set());
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set());
  const [selectedGuiaStatus, setSelectedGuiaStatus] = useState<Set<string>>(new Set());
  const [selectedTurnos, setSelectedTurnos] = useState<Set<string>>(new Set());

  const therapistOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(s.therapistId, s.therapistName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) if (s.discipline) set.add(s.discipline);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const guiaStatusOptions = [
    { id: "com_guia", label: "Com Guia / Autorização" },
    { id: "sem_guia", label: "Pendente de Guia" },
  ];

  const turnoOptions = [
    { id: "manha", label: "Manhã (até 12h)" },
    { id: "tarde", label: "Tarde (12h às 18h)" },
    { id: "noite", label: "Noite (após 18h)" },
  ];

  const counts = useMemo(() => {
    let aConfirmar = 0;
    let emAtendimento = 0;
    let faltas = 0;
    for (const s of sessions) {
      const state = uiStateOf(s);
      if (s.status === "agendada") aConfirmar += 1;
      if (state === "na_recepcao" || state === "em_atendimento") emAtendimento += 1;
      if (s.status === "falta_familia") faltas += 1;
    }
    return { todas: sessions.length, aConfirmar, emAtendimento, faltas };
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filter === "aConfirmar" && s.status !== "agendada") return false;
      if (filter === "emAtendimento") {
        const state = uiStateOf(s);
        if (state !== "na_recepcao" && state !== "em_atendimento") return false;
      }
      if (filter === "faltas" && s.status !== "falta_familia") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const qDigits = q.replace(/\D/g, "");
        const matchPatient = s.patientName.toLowerCase().includes(q);
        const matchTherapist = s.therapistName.toLowerCase().includes(q);
        const matchDiscipline = s.discipline.toLowerCase().includes(q);
        const guardians = guardiansByPatient[s.patientId] ?? [];
        const matchGuardianName = guardians.some((g) => g.fullName.toLowerCase().includes(q));
        const matchGuardianPhone = qDigits.length > 0 && guardians.some((g) => g.phone.replace(/\D/g, "").includes(qDigits));
        if (!matchPatient && !matchTherapist && !matchDiscipline && !matchGuardianName && !matchGuardianPhone) {
          return false;
        }
      }
      if (selectedTherapistIds.size && !selectedTherapistIds.has(s.therapistId)) return false;
      if (selectedDisciplines.size && !selectedDisciplines.has(s.discipline)) return false;
      if (selectedGuiaStatus.size) {
        const hasGuia = Boolean(s.authorizationId);
        if (selectedGuiaStatus.has("com_guia") && !selectedGuiaStatus.has("sem_guia") && !hasGuia) return false;
        if (selectedGuiaStatus.has("sem_guia") && !selectedGuiaStatus.has("com_guia") && hasGuia) return false;
      }
      if (selectedTurnos.size) {
        const hour = new Date(s.startsAt).getHours();
        let turno = "tarde";
        if (hour < 12) turno = "manha";
        else if (hour >= 18) turno = "noite";
        if (!selectedTurnos.has(turno)) return false;
      }
      return true;
    });
  }, [sessions, filter, search, selectedTherapistIds, selectedDisciplines, selectedGuiaStatus, selectedTurnos, guardiansByPatient]);

  const grouped = useMemo(() => {
    if (groupMode !== "profissional") return null;
    const byTherapist = new Map<string, { therapistName: string; sessions: TodaySession[] }>();
    for (const s of filtered) {
      const entry = byTherapist.get(s.therapistId) ?? { therapistName: s.therapistName, sessions: [] };
      entry.sessions.push(s);
      byTherapist.set(s.therapistId, entry);
    }
    return Array.from(byTherapist.values()).sort((a, b) => a.therapistName.localeCompare(b.therapistName));
  }, [filtered, groupMode]);

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: counts.todas },
    { key: "aConfirmar", label: "A confirmar", count: counts.aConfirmar },
    { key: "emAtendimento", label: "Em atendimento", count: counts.emAtendimento },
    { key: "faltas", label: "Faltas", count: counts.faltas },
  ];

  const activeFilterCount =
    selectedTherapistIds.size +
    selectedDisciplines.size +
    selectedGuiaStatus.size +
    selectedTurnos.size;
  const selectedRoomSession = selectedRoomSessionId
    ? (filtered.find((s) => s.id === selectedRoomSessionId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros da grade e controles de visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2 ${
                filter === f.key
                  ? "border-[#E81E61] bg-[#E81E61] text-white shadow-xs"
                  : "border-neutral-300 bg-white text-[#4a4a4a] hover:border-[#E81E61] hover:text-[#E81E61]"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Buscar por paciente…"
              className="input pl-8 pr-8 w-52 text-xs focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-1"
            />
            {searchRaw.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchRaw("")}
                className="absolute right-2.5 text-neutral-400 hover:text-neutral-700 focus:outline-none"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="seg">
            <label className="seg-opt">
              <input type="radio" name="group-mode" checked={groupMode === "lista"} onChange={() => setGroupMode("lista")} />
              Lista
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name="group-mode"
                checked={groupMode === "profissional"}
                onChange={() => setGroupMode("profissional")}
              />
              Por terapeuta
            </label>
            <label className="seg-opt">
              <input type="radio" name="group-mode" checked={groupMode === "sala"} onChange={() => setGroupMode("sala")} />
              Por sala
            </label>
          </div>
        </div>
      </div>

      {/* Painel Horizontal de Filtros Avançados */}
      <details className="rounded-md border border-paper-line-strong bg-paper/60" open>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#595959] hover:text-ink">
          Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
        </summary>
        <div className="flex flex-wrap items-start gap-6 border-t border-paper-line-strong p-3">
          {/* Terapeutas */}
          <details className="min-w-[170px]" open>
            <summary className="cursor-pointer text-xs font-semibold text-[#333333]">
              Terapeutas {selectedTherapistIds.size > 0 ? `(${selectedTherapistIds.size})` : ""}
            </summary>
            <div className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
              {therapistOptions.length === 0 && <p className="text-xs text-[#595959]">Nenhum hoje.</p>}
              {therapistOptions.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-[#333333] hover:bg-neutral-100/80 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[#E81E61]"
                >
                  <input
                    type="checkbox"
                    checked={selectedTherapistIds.has(t.id)}
                    onChange={() => setSelectedTherapistIds((prev) => toggleInSet(prev, t.id))}
                    className="h-4 w-4 rounded border-neutral-300 text-[#E81E61] focus:ring-[#E81E61] cursor-pointer"
                  />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </details>

          {/* Disciplinas */}
          <details className="min-w-[170px]" open>
            <summary className="cursor-pointer text-xs font-semibold text-[#333333]">
              Especialidades {selectedDisciplines.size > 0 ? `(${selectedDisciplines.size})` : ""}
            </summary>
            <div className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
              {disciplineOptions.length === 0 && <p className="text-xs text-[#595959]">Nenhuma hoje.</p>}
              {disciplineOptions.map((disc) => (
                <label
                  key={disc}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-[#333333] hover:bg-neutral-100/80 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[#E81E61]"
                >
                  <input
                    type="checkbox"
                    checked={selectedDisciplines.has(disc)}
                    onChange={() => setSelectedDisciplines((prev) => toggleInSet(prev, disc))}
                    className="h-4 w-4 rounded border-neutral-300 text-[#E81E61] focus:ring-[#E81E61] cursor-pointer"
                  />
                  <span>{disc}</span>
                </label>
              ))}
            </div>
          </details>

          {/* Validação de Guias */}
          <details className="min-w-[170px]" open>
            <summary className="cursor-pointer text-xs font-semibold text-[#333333]">
              Status da Guia {selectedGuiaStatus.size > 0 ? `(${selectedGuiaStatus.size})` : ""}
            </summary>
            <div className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
              {guiaStatusOptions.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-[#333333] hover:bg-neutral-100/80 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[#E81E61]"
                >
                  <input
                    type="checkbox"
                    checked={selectedGuiaStatus.has(g.id)}
                    onChange={() => setSelectedGuiaStatus((prev) => toggleInSet(prev, g.id))}
                    className="h-4 w-4 rounded border-neutral-300 text-[#E81E61] focus:ring-[#E81E61] cursor-pointer"
                  />
                  <span>{g.label}</span>
                </label>
              ))}
            </div>
          </details>

          {/* Turno de Atendimento */}
          <details className="min-w-[150px]" open>
            <summary className="cursor-pointer text-xs font-semibold text-[#333333]">
              Turno {selectedTurnos.size > 0 ? `(${selectedTurnos.size})` : ""}
            </summary>
            <div className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
              {turnoOptions.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-[#333333] hover:bg-neutral-100/80 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[#E81E61]"
                >
                  <input
                    type="checkbox"
                    checked={selectedTurnos.has(t.id)}
                    onChange={() => setSelectedTurnos((prev) => toggleInSet(prev, t.id))}
                    className="h-4 w-4 rounded border-neutral-300 text-[#E81E61] focus:ring-[#E81E61] cursor-pointer"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </details>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedTherapistIds(new Set());
                setSelectedDisciplines(new Set());
                setSelectedGuiaStatus(new Set());
                setSelectedTurnos(new Set());
              }}
              className="self-center text-xs text-chart underline ml-auto"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </details>

      <div className="flex flex-col gap-4">

        {filtered.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhuma sessão encontrada para esse filtro.</p>
        )}

        {groupMode === "lista" &&
          filtered.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              guardians={guardiansByPatient[session.patientId] ?? []}
              setModalPatient={setModalPatient}
              setShowGuiaModal={setShowGuiaModal}
            />
          ))}

        {groupMode === "profissional" &&
          grouped?.map((group) => (
            <div key={group.therapistName} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 border-b border-paper-line-strong pb-1.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold"
                  style={{ background: "var(--color-accent-2)", color: "var(--color-accent)" }}
                >
                  {initials(group.therapistName)}
                </span>
                <span style={{ fontFamily: "var(--font-heading)" }} className="text-sm font-semibold text-ink">
                  {group.therapistName} ({group.sessions.length})
                </span>
              </div>
              {group.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  guardians={guardiansByPatient[session.patientId] ?? []}
                  setModalPatient={setModalPatient}
                  setShowGuiaModal={setShowGuiaModal}
                />
              ))}
            </div>
          ))}

        {groupMode === "sala" && (
          <RoomGrid rooms={rooms} sessions={filtered} onSelect={setSelectedRoomSessionId} />
        )}

        {/* Modal de Ação Rápida de Guias */}
        {modalPatient && (
          <GuiaQuickActionModal
            isOpen={showGuiaModal}
            onClose={() => {
              setShowGuiaModal(false);
              setModalPatient(null);
            }}
            patientId={modalPatient.id}
            patientName={modalPatient.name}
            appointmentId={modalPatient.appointmentId}
          />
        )}

      {selectedRoomSession && (
        <div className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto border-l border-paper-line-strong bg-paper p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Sessão selecionada</h3>
            <button type="button" onClick={() => setSelectedRoomSessionId(null)} className="btn btn-icon">
              <X size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <SessionRow
                session={selectedRoomSession}
                guardians={guardiansByPatient[selectedRoomSession.patientId] ?? []}
                setModalPatient={setModalPatient}
                setShowGuiaModal={setShowGuiaModal}
              />

            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function RoomGrid({
  rooms,
  sessions,
  onSelect,
}: {
  rooms: { id: string; name: string }[];
  sessions: TodaySession[];
  onSelect: (id: string) => void;
}) {
  if (rooms.length === 0) {
    return <p className="text-sm text-ink-faint">Nenhuma sala cadastrada.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-paper-line-strong bg-paper/60">
      <div className="grid min-w-[600px]" style={{ gridTemplateColumns: `72px repeat(${rooms.length}, 1fr)` }}>
        <div className="border-b border-r border-paper-line-strong" />
        {rooms.map((room) => (
          <div
            key={room.id}
            className="border-b border-r border-paper-line-strong px-2 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft last:border-r-0"
          >
            {room.name}
          </div>
        ))}
        {GRID_HOURS.map((hour) =>
          GRID_MINUTES.map((minute) => {
            const slotLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
            return (
              <div key={slotLabel} className="contents">
                <div className="border-b border-r border-paper-line-strong px-2 py-2 font-mono text-[11px] text-ink-faint">
                  {slotLabel}
                </div>
                {rooms.map((room) => {
                  const matches = sessions.filter(
                    (s) => s.roomId === room.id && civilTimeInTimeZone(s.startsAt, CLINIC_TIMEZONE) === slotLabel,
                  );
                  return (
                    <div key={room.id} className="min-h-12 border-b border-r border-paper-line-strong p-1 last:border-r-0">
                      {matches.map((s) => {
                        const display = statusDisplay(s);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onSelect(s.id)}
                            className="mb-1.5 w-full rounded-md border border-paper-line/80 bg-paper/90 p-1.5 text-left text-[11px] last:mb-0 hover:border-chart hover:shadow-xs transition-all"
                          >
                            <PatientFormattedDisplay
                              name={s.patientName}
                              isEvaluation={s.isEvaluation}
                              subtitle={s.therapistName}
                              showAvatar={false}
                              size="sm"
                            />
                            <div className="mt-1">
                              <PatientStatusBadge status={uiStateOf(s) !== "aguardando" ? uiStateOf(s) : s.status} customLabel={display.label} size="sm" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  guardians,
  setModalPatient,
  setShowGuiaModal,
}: {
  session: TodaySession;
  guardians: GuardianContact[];
  setModalPatient: (p: { id: string; name: string; appointmentId?: string }) => void;
  setShowGuiaModal: (v: boolean) => void;
}) {

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showFaltaForm, setShowFaltaForm] = useState(false);
  const [showGuardians, setShowGuardians] = useState(false);
  const [showLinkGuide, setShowLinkGuide] = useState(false);
  const [guideOptions, setGuideOptions] = useState<PatientAuthorizationOption[] | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState("");
  const [showChegadaModal, setShowChegadaModal] = useState(false);

  const uiState = uiStateOf(session);
  const display = statusDisplay(session);

  const canConfirm = session.status === "agendada";
  const canCheckin = (session.status === "agendada" || session.status === "confirmada") && !session.checkinAt;
  const canCheckout = Boolean(session.checkinAt) && !session.checkoutAt;
  const canReschedule = uiState === "aguardando" || uiState === "na_recepcao" || uiState === "em_atendimento";
  const durationMinutes = Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60_000);

  const canLinkGuide = !session.authorizationId && !session.isProvisional && !session.isEvaluation;
  const canUndoAutoFalta = session.status === "falta_familia" && session.autoMarked && !session.checkoutAt;

  const isAguardando = session.status === "agendada" && !session.checkinAt;
  const isConfirmado = session.status === "confirmada" && !session.checkinAt;
  const isCheckedIn = Boolean(session.checkinAt);
  const isFaltaOrCancelled = NEGATIVE_STATUSES.some((s) => s.value === session.status) || session.status === "falta_familia";

  function runAction(action: () => Promise<{ success: true; warning?: string } | { success: false; error: string }>) {
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
      else if (result.warning) setWarning(result.warning);
    });
  }

  // Não usa runAction: precisa do `coupon` que checkIn() devolve, um campo a
  // mais do que o tipo estreito de runAction carrega.
  function handleCheckIn() {
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await checkIn(session.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.warning) setWarning(result.warning);
      if (result.coupon) printCoupon(result.coupon);
    });
  }

  function handleChegadaConfirmed(result: { warning?: string; coupon?: unknown }) {
    setWarning(result.warning ?? null);
  }

  function handleReprintCoupon() {
    setError(null);
    startTransition(async () => {
      const result = await getCheckinCoupon(session.patientId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      printCoupon(result.coupon);
    });
  }

  function openLinkGuide() {
    setShowLinkGuide(true);
    if (!guideOptions) {
      getPatientActiveAuthorizations(session.patientId).then(setGuideOptions);
    }
  }

  return (
    <div
      className="grid items-center gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3"
      style={{ gridTemplateColumns: "72px 1fr 130px auto" }}
    >
      <div className="text-xs">
        <p className="font-mono font-medium text-ink">{formatTime(session.startsAt)}</p>
        <p className="text-ink-faint">{durationLabel(session.startsAt, session.endsAt)}</p>
      </div>

      <div className="min-w-0">
        <PatientFormattedDisplay
          name={session.patientName}
          isEvaluation={session.isEvaluation}
          size="md"
          subtitle={
            <div className="truncate text-xs text-ink-soft">
              <span>{session.discipline}</span> · <span>{session.therapistName}</span> ·{" "}
              <span className="text-ink-faint">{session.roomName}</span>
            </div>
          }
        />
      </div>

      <div className="text-xs flex flex-col items-start gap-1">
        <PatientStatusBadge
          status={uiState !== "aguardando" ? uiState : session.status}
          customLabel={display.label}
          size="md"
        />

        {/* Guia status & Quick action */}
        {session.authorizationId ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            <FileText className="h-3 w-3" /> Guia Vinculada
          </span>
        ) : session.isProvisional ? (
          <button
            type="button"
            onClick={() => {
              setModalPatient({ id: session.patientId, name: session.patientName, appointmentId: session.id });
              setShowGuiaModal(true);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 transition-colors"
          >
            <ShieldAlert className="h-3 w-3 text-amber-500" /> Provisória (+ Guia)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setModalPatient({ id: session.patientId, name: session.patientName, appointmentId: session.id });
              setShowGuiaModal(true);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-chart hover:underline bg-paper-line-strong/40 px-2 py-0.5 rounded"
          >
            <Plus className="h-3 w-3" /> + Guia
          </button>
        )}


        {canUndoAutoFalta && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => undoAutoFalta(session.id))}
            className="mt-1 block text-[11px] font-medium text-ink-soft underline decoration-dotted hover:text-ink disabled:opacity-50"
          >
            Falta automática · desfazer
          </button>
        )}

        {showFaltaForm && (
          <form
            className="mt-2 flex flex-col gap-1.5"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await markMissedOrCancelled(session.id, formData);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setShowFaltaForm(false);
              });
            }}
          >
            <select name="target_status" required className="input text-xs">
              <option value="">Status</option>
              {NEGATIVE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select name="reason" required className="input text-xs">
              <option value="">Motivo</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <input type="text" name="reason_other" placeholder="Descreva (se 'Outro')" className="input text-xs" />
            <div className="flex gap-1.5">
              <button type="submit" disabled={isPending} className="btn btn-primary text-xs">Salvar</button>
              <button type="button" onClick={() => setShowFaltaForm(false)} className="btn btn-secondary text-xs">Voltar</button>
            </div>
          </form>
        )}
        {error && <p className="mt-1 text-[11px] text-status-negative-text">{error}</p>}
        {warning && (
          <p className="mt-1 text-[11px]" style={{ color: "var(--status-agendada)" }}>
            ⚠ {warning}
          </p>
        )}

        {canLinkGuide && !showLinkGuide && (
          <button type="button" onClick={openLinkGuide} className="mt-1 text-[11px] text-chart underline">
            Vincular guia
          </button>
        )}
        {canLinkGuide && showLinkGuide && (
          <div className="mt-2 flex flex-col gap-1.5">
            {guideOptions === null ? (
              <p className="text-[11px] text-ink-faint">Carregando guias…</p>
            ) : guideOptions.length === 0 ? (
              <p className="text-[11px] text-ink-faint">Paciente sem guia ativa.</p>
            ) : (
              <select
                value={selectedGuideId}
                onChange={(e) => setSelectedGuideId(e.target.value)}
                className="input text-xs"
              >
                <option value="">Selecione a guia</option>
                {guideOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.procedureCode} · {g.guideNumber ?? "s/ nº"} · {g.sessionsUsed}/{g.sessionsAuthorized}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={isPending || !selectedGuideId}
                onClick={() =>
                  runAction(async () => {
                    const result = await linkAuthorizationToAppointment(session.id, selectedGuideId);
                    if (result.success) {
                      setShowLinkGuide(false);
                      setSelectedGuideId("");
                    }
                    return result;
                  })
                }
                className="btn btn-primary text-xs"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkGuide(false);
                  setSelectedGuideId("");
                }}
                className="btn btn-secondary text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={isPending || isAguardando}
          onClick={() => runAction(() => setAguardando(session.id))}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-200 ease-in-out transform active:scale-95 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2 ${
            isAguardando
              ? "bg-amber-500 text-white font-bold border border-amber-600 shadow-sm"
              : "bg-white text-[#4a4a4a] font-medium border border-neutral-300 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300"
          }`}
          title="Marcar paciente aguardando na recepção"
        >
          <Clock className={`h-3.5 w-3.5 ${isAguardando ? "text-white" : "text-amber-600"}`} />
          <span>Aguardando</span>
        </button>

        <button
          type="button"
          disabled={isPending || isConfirmado}
          onClick={() => runAction(() => confirmAppointment(session.id))}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-200 ease-in-out transform active:scale-95 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2 ${
            isConfirmado
              ? "bg-sky-600 text-white font-bold border border-sky-700 shadow-sm"
              : "bg-white text-[#4a4a4a] font-medium border border-neutral-300 hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300"
          }`}
          title="Confirmar presença agendada"
        >
          <CheckCircle2 className={`h-3.5 w-3.5 ${isConfirmado ? "text-white" : "text-sky-600"}`} />
          <span>Confirmado</span>
        </button>

        <button
          type="button"
          disabled={isPending || isCheckedIn}
          onClick={session.isEvaluation ? () => setShowChegadaModal(true) : handleCheckIn}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-200 ease-in-out transform active:scale-95 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2 ${
            isCheckedIn
              ? "bg-emerald-600 text-white font-bold border border-emerald-700 shadow-sm"
              : "bg-white text-[#4a4a4a] font-medium border border-neutral-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300"
          }`}
          title={
            session.isEvaluation
              ? "Registrar chegada (guia e laudo opcionais) e imprimir cupom"
              : "Realizar check-in de entrada"
          }
        >
          <UserCheck className={`h-3.5 w-3.5 ${isCheckedIn ? "text-white" : "text-emerald-600"}`} />
          <span>{session.isEvaluation ? "Chegada" : "Check-in"}</span>
        </button>

        {session.isEvaluation && showChegadaModal && (
          <ChegadaAvaliacaoModal
            isOpen={showChegadaModal}
            onClose={() => setShowChegadaModal(false)}
            appointmentId={session.id}
            patientId={session.patientId}
            patientName={session.patientName}
            onConfirmed={handleChegadaConfirmed}
          />
        )}

        {isCheckedIn && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleReprintCoupon}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#4a4a4a] transition-all duration-200 ease-in-out transform active:scale-95 hover:bg-neutral-50 hover:text-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2"
            title="Reimprimir cupom de check-in"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Reimprimir cupom</span>
          </button>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowFaltaForm((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-200 ease-in-out transform active:scale-95 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2 ${
            isFaltaOrCancelled || showFaltaForm
              ? "bg-rose-600 text-white font-bold border border-rose-700 shadow-sm"
              : "bg-white text-[#4a4a4a] font-medium border border-neutral-300 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300"
          }`}
          title="Registrar falta ou cancelamento da sessão"
        >
          <XCircle className={`h-3.5 w-3.5 ${isFaltaOrCancelled || showFaltaForm ? "text-white" : "text-rose-600"}`} />
          <span>Falta / Cancelar</span>
        </button>
      </div>
    </div>
  );
}
