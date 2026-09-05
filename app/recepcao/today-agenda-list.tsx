"use client";

import { useMemo, useState, useTransition } from "react";
import { User, PenLine, CalendarClock, X } from "lucide-react";
import {
  confirmAppointment,
  checkIn,
  checkOut,
  markMissedOrCancelled,
} from "./agenda/session-actions";
import { ReagendamentoDialog } from "./agenda/reagendamento-dialog";
import { computeAppointmentUiState, UI_STATE_LABEL, type AppointmentUiState } from "@/lib/appointment-ui-state";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilTimeInTimeZone } from "@/lib/timezone";

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
  /** Sessão `realizada` sem session_notes assinada ainda — ver session_note_pending (RPC). */
  pendingNote: boolean;
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
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("lista");
  const [selectedRoomSessionId, setSelectedRoomSessionId] = useState<string | null>(null);

  const [selectedTherapistIds, setSelectedTherapistIds] = useState<Set<string>>(new Set());
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const therapistOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(s.therapistId, s.therapistName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const tagOptions = useMemo(() => {
    const patientIds = new Set(sessions.map((s) => s.patientId));
    const tags = new Set<string>();
    for (const pid of patientIds) {
      for (const tag of tagsByPatient[pid] ?? []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [sessions, tagsByPatient]);

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
      if (search.trim() && !s.patientName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (selectedTherapistIds.size && !selectedTherapistIds.has(s.therapistId)) return false;
      if (selectedTypeIds.size && (!s.appointmentTypeId || !selectedTypeIds.has(s.appointmentTypeId))) return false;
      if (selectedTags.size) {
        const patientTags = tagsByPatient[s.patientId] ?? [];
        if (!patientTags.some((t) => selectedTags.has(t))) return false;
      }
      return true;
    });
  }, [sessions, filter, search, selectedTherapistIds, selectedTypeIds, selectedTags, tagsByPatient]);

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

  const activeFilterCount = selectedTherapistIds.size + selectedTypeIds.size + selectedTags.size;
  const selectedRoomSession = selectedRoomSessionId
    ? (filtered.find((s) => s.id === selectedRoomSessionId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "border-chart bg-chart text-paper"
                    : "border-paper-line-strong text-ink-soft hover:border-chart"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente…"
              className="input w-48 text-xs"
            />
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
                Por profissional
              </label>
              <label className="seg-opt">
                <input type="radio" name="group-mode" checked={groupMode === "sala"} onChange={() => setGroupMode("sala")} />
                Por sala
              </label>
            </div>
          </div>
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhuma sessão encontrada para esse filtro.</p>
        )}

        {groupMode === "lista" &&
          filtered.map((session) => (
            <SessionRow key={session.id} session={session} guardians={guardiansByPatient[session.patientId] ?? []} />
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
                <SessionRow key={session.id} session={session} guardians={guardiansByPatient[session.patientId] ?? []} />
              ))}
            </div>
          ))}

        {groupMode === "sala" && (
          <RoomGrid rooms={rooms} sessions={filtered} onSelect={setSelectedRoomSessionId} />
        )}
      </div>

      <aside className="w-full shrink-0 lg:w-64">
        <details className="rounded-md border border-paper-line-strong bg-paper/60" open>
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
          </summary>
          <div className="flex flex-col gap-3 border-t border-paper-line-strong p-3">
            <details open>
              <summary className="cursor-pointer text-xs font-medium text-ink">Profissionais</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {therapistOptions.length === 0 && <p className="text-xs text-ink-faint">Nenhum hoje.</p>}
                {therapistOptions.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={selectedTherapistIds.has(t.id)}
                      onChange={() => setSelectedTherapistIds((prev) => toggleInSet(prev, t.id))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </details>

            <details>
              <summary className="cursor-pointer text-xs font-medium text-ink">Tipo de atendimento</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {appointmentTypes.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={selectedTypeIds.has(t.id)}
                      onChange={() => setSelectedTypeIds((prev) => toggleInSet(prev, t.id))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </details>

            <details>
              <summary className="cursor-pointer text-xs font-medium text-ink">Tags do paciente</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {tagOptions.length === 0 && <p className="text-xs text-ink-faint">Nenhuma tag hoje.</p>}
                {tagOptions.map((tag) => (
                  <label key={tag} className="flex items-center gap-1.5 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={selectedTags.has(tag)}
                      onChange={() => setSelectedTags((prev) => toggleInSet(prev, tag))}
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </details>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTherapistIds(new Set());
                  setSelectedTypeIds(new Set());
                  setSelectedTags(new Set());
                }}
                className="self-start text-xs text-chart underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </details>
      </aside>

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
              />
            </div>
          </div>
        </div>
      )}
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
                            className="mb-1 w-full rounded bg-chart-soft px-1.5 py-1 text-left text-[11px] last:mb-0 hover:brightness-95"
                          >
                            <p className="truncate font-medium text-ink">{s.patientName}</p>
                            <p className="truncate text-ink-soft">{s.therapistName}</p>
                            <span className={`tag-status ${display.tagClass}`}>{display.label}</span>
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

function SessionRow({ session, guardians }: { session: TodaySession; guardians: GuardianContact[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showFaltaForm, setShowFaltaForm] = useState(false);
  const [showGuardians, setShowGuardians] = useState(false);

  const uiState = uiStateOf(session);
  const display = statusDisplay(session);

  const canConfirm = session.status === "agendada";
  const canCheckin = (session.status === "agendada" || session.status === "confirmada") && !session.checkinAt;
  const canCheckout = Boolean(session.checkinAt) && !session.checkoutAt;
  const canReschedule = uiState === "aguardando" || uiState === "na_recepcao" || uiState === "em_atendimento";
  const durationMinutes = Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60_000);

  function runAction(action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  function handleStatusChange(value: string) {
    if (value === "confirmar") runAction(() => confirmAppointment(session.id));
    else if (value === "checkin") runAction(() => checkIn(session.id));
    else if (value === "checkout") runAction(() => checkOut(session.id));
    else if (value === "falta_cancelar") setShowFaltaForm(true);
  }

  return (
    <div
      className="grid items-center gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3"
      style={{ gridTemplateColumns: "72px 1fr 170px 132px" }}
    >
      <div className="text-xs">
        <p className="font-mono font-medium text-ink">{formatTime(session.startsAt)}</p>
        <p className="text-ink-faint">{durationLabel(session.startsAt, session.endsAt)}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{session.patientName}</p>
        <p className="truncate text-xs text-ink-soft">
          {session.discipline} · {session.therapistName}
        </p>
        <p className="truncate text-xs text-ink-faint">{session.roomName}</p>
      </div>

      <div className="text-xs">
        {(uiState === "aguardando" && (canConfirm || canCheckin)) ? (
          <select
            value=""
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isPending}
            className={`tag-status ${display.tagClass} cursor-pointer border-0`}
          >
            <option value="" disabled>
              {display.label}
            </option>
            {canConfirm && <option value="confirmar">Confirmar</option>}
            {canCheckin && <option value="checkin">Check-in</option>}
            <option value="falta_cancelar">Falta / Cancelar</option>
          </select>
        ) : canCheckout ? (
          <select
            value=""
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isPending}
            className={`tag-status ${display.tagClass} cursor-pointer border-0`}
          >
            <option value="" disabled>
              {display.label}
            </option>
            <option value="checkout">Check-out</option>
          </select>
        ) : (
          <span className={`tag-status ${display.tagClass}`}>{display.label}</span>
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
      </div>

      <div className="relative flex items-center justify-end gap-1.5">
        <button
          type="button"
          title="Responsáveis"
          onClick={() => setShowGuardians((v) => !v)}
          className="btn btn-icon"
        >
          <User size={16} />
        </button>
        {showGuardians && (
          <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-paper-line-strong bg-paper p-3 text-xs shadow-lg">
            {guardians.length === 0 && <p className="text-ink-faint">Nenhum responsável cadastrado.</p>}
            {guardians.map((g, i) => (
              <div key={i} className="border-b border-paper-line py-1.5 last:border-0">
                <p className="font-medium text-ink">
                  {g.fullName} {g.isEmergencyContact && <span className="text-ink-faint">· emergência</span>}
                </p>
                <p className="text-ink-soft">{g.relationship ?? "—"} · {g.phone}</p>
              </div>
            ))}
          </div>
        )}

        {session.status === "realizada" && session.pendingNote ? (
          <a
            href={`/terapeuta/evolucao/${session.id}`}
            target="_blank"
            rel="noreferrer"
            title="Registro pendente"
            className="btn btn-icon"
            style={{ color: "var(--status-falta)", borderColor: "var(--status-falta)" }}
          >
            <PenLine size={16} />
          </a>
        ) : (
          <span
            title={session.status === "realizada" ? "Registro já feito" : "Registro só após a sessão"}
            className="btn btn-icon opacity-30"
            aria-disabled
          >
            <PenLine size={16} />
          </span>
        )}

        {canReschedule ? (
          <ReagendamentoDialog
            appointmentId={session.id}
            patientName={session.patientName}
            therapistName={session.therapistName}
            roomId={session.roomId}
            therapistId={session.therapistId}
            durationMinutes={durationMinutes}
          />
        ) : (
          <span title="Não é possível reagendar" className="btn btn-icon opacity-30" aria-disabled>
            <CalendarClock size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
