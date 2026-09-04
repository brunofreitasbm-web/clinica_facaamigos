"use client";

// Lista "Agenda do dia" da home da recepção (Recepcao.dc.html) — reusa as
// mesmas Server Actions da agenda por sala (app/recepcao/agenda/session-actions.ts)
// em vez de duplicar a lógica de confirmar/check-in/check-out/falta.

import { useMemo, useState, useTransition } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { computeAppointmentUiState, UI_STATE_LABEL, type AppointmentUiState } from "@/lib/appointment-ui-state";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { confirmAppointment, checkIn, checkOut, markMissedOrCancelled } from "./agenda/session-actions";

export type TodaySession = {
  id: string;
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
};

type FilterKey = "todas" | "aConfirmar" | "emAtendimento" | "faltas";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

function durationLabel(startsAt: string, endsAt: string): string {
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  return `${minutes} min`;
}

function uiStateOf(s: TodaySession): AppointmentUiState | null {
  if (s.status !== "agendada" && s.status !== "confirmada") return null;
  return computeAppointmentUiState(s);
}

function statusDisplay(s: TodaySession): { label: string; tagClass: string } {
  const uiState = uiStateOf(s);
  if (uiState === "na_recepcao" || uiState === "em_atendimento") {
    return { label: UI_STATE_LABEL[uiState], tagClass: "st-em-atendimento" };
  }
  if (uiState === "aguardando") {
    return s.status === "confirmada"
      ? { label: "Confirmada", tagClass: "st-confirmada" }
      : { label: "A confirmar", tagClass: "st-agendada" };
  }
  const style = APPOINTMENT_STATUS_STYLE[s.status];
  return style ? { label: style.label, tagClass: style.tagClass } : { label: s.status, tagClass: "st-cancelada" };
}

export function TodayAgendaList({ sessions }: { sessions: TodaySession[] }) {
  const [filter, setFilter] = useState<FilterKey>("todas");

  const counts = useMemo(() => {
    let aConfirmar = 0;
    let emAtendimento = 0;
    let faltas = 0;
    for (const s of sessions) {
      if (s.status === "agendada") aConfirmar++;
      const uiState = uiStateOf(s);
      if (uiState === "na_recepcao" || uiState === "em_atendimento") emAtendimento++;
      if (s.status === "falta_familia") faltas++;
    }
    return { todas: sessions.length, aConfirmar, emAtendimento, faltas };
  }, [sessions]);

  const visible = useMemo(() => {
    switch (filter) {
      case "aConfirmar":
        return sessions.filter((s) => s.status === "agendada");
      case "emAtendimento":
        return sessions.filter((s) => {
          const uiState = uiStateOf(s);
          return uiState === "na_recepcao" || uiState === "em_atendimento";
        });
      case "faltas":
        return sessions.filter((s) => s.status === "falta_familia");
      default:
        return sessions;
    }
  }, [sessions, filter]);

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: counts.todas },
    { key: "aConfirmar", label: "A confirmar", count: counts.aConfirmar },
    { key: "emAtendimento", label: "Em atendimento", count: counts.emAtendimento },
    { key: "faltas", label: "Faltas", count: counts.faltas },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2.5 text-[13px]">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className="btn btn-secondary"
            style={{
              fontSize: 13,
              padding: "6px 12px",
              background: filter === c.key ? "var(--color-accent-100)" : undefined,
              borderColor: filter === c.key ? "transparent" : undefined,
            }}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {visible.length === 0 && <p className="py-6 text-sm text-ink-faint">Nenhuma sessão nesse filtro.</p>}
        {visible.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </div>
    </div>
  );
}

function SessionRow({ session: s }: { session: TodaySession }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showFaltaForm, setShowFaltaForm] = useState(false);
  const display = statusDisplay(s);

  const canConfirm = s.status === "agendada";
  const canCheckin = (s.status === "agendada" || s.status === "confirmada") && !s.checkinAt;
  const canCheckout = !!s.checkinAt && !s.checkoutAt;
  const canFalta = canCheckin;

  function runAction(action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div
      className="grid items-center gap-5 border-b py-4 px-3"
      style={{
        gridTemplateColumns: "72px 1fr 150px 220px",
        borderColor: "color-mix(in srgb, var(--color-text) 8%, transparent)",
      }}
    >
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20, lineHeight: 1 }}>
        {formatTime(s.startsAt)}
        <div className="mt-1 text-xs font-normal" style={{ color: "var(--color-neutral-600)" }}>
          {durationLabel(s.startsAt, s.endsAt)}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 17 }}>{s.patientName}</span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            Guia Vigente
          </span>
        </div>
        <div className="mt-0.5 text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
          {s.discipline} · {s.therapistName} · {s.roomName}
        </div>
        {error && <p className="mt-1 text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
        {showFaltaForm && (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await markMissedOrCancelled(s.id, formData);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setShowFaltaForm(false);
              });
            }}
          >
            <select name="target_status" required className="input" style={{ width: "auto", fontSize: 12, minHeight: 30 }}>
              {NEGATIVE_STATUSES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
            <select name="reason" required className="input" style={{ width: "auto", fontSize: 12, minHeight: 30 }}>
              <option value="">Motivo…</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="reason_other"
              placeholder="Se 'Outro'"
              className="input"
              style={{ width: 120, fontSize: 12, minHeight: 30 }}
            />
            <button type="submit" disabled={isPending} className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
              Registrar
            </button>
            <button
              type="button"
              onClick={() => setShowFaltaForm(false)}
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "4px 6px" }}
            >
              Voltar
            </button>
          </form>
        )}
      </div>
      <div>
        <span className={`tag-status ${display.tagClass}`}>{display.label}</span>
      </div>
      <div className="flex justify-end gap-1.5">
        {canConfirm && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => confirmAppointment(s.id))}
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            Confirmar
          </button>
        )}
        {canCheckin && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => checkIn(s.id))}
            className="btn btn-primary"
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            Check-in
          </button>
        )}
        {canCheckout && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => checkOut(s.id))}
            className="btn btn-primary"
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            Check-out
          </button>
        )}
        {canFalta && !showFaltaForm && (
          <button
            type="button"
            onClick={() => setShowFaltaForm(true)}
            className="btn btn-ghost"
            style={{ fontSize: 13, color: "var(--status-falta)" }}
          >
            Falta
          </button>
        )}
      </div>
    </div>
  );
}
