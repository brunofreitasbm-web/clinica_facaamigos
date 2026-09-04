// app/recepcao/agenda/appointment-panel.tsx
"use client";

import { useState, useTransition } from "react";
import type { AgendaAppointment } from "./day-grid";
import { STATUS_LABEL } from "./day-grid";
import { checkIn, checkOut, markMissedOrCancelled } from "./session-actions";
import { computeAppointmentUiState } from "@/lib/appointment-ui-state";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { CLINIC_TIMEZONE } from "@/lib/constants";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

function cancelReasonLabel(reason: string | null): string {
  if (!reason) return "não informado";
  return CANCEL_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function AppointmentPanel({
  appointment,
  onClose,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCancelForm, setShowCancelForm] = useState(false);

  const uiState = computeAppointmentUiState(appointment);

  function runAction(
    action: () => Promise<{ success: true } | { success: false; error: string }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-paper-line-strong bg-paper p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)} · {appointment.roomName}
          </h2>
          <p className="mt-1 text-lg font-medium text-ink">{appointment.patientName}</p>
          <p className="text-sm text-ink-soft">{appointment.therapistName}</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-ink-faint hover:text-ink">
          Fechar
        </button>
      </div>

      <p className="text-sm text-ink-soft">
        Status: <span className="font-medium text-ink">{STATUS_LABEL[appointment.status] ?? appointment.status}</span>
      </p>

      {uiState === "aguardando" && !showCancelForm && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => checkIn(appointment.id))}
            className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
          >
            {isPending ? "Registrando…" : "Check-in"}
          </button>
          <button
            type="button"
            onClick={() => setShowCancelForm(true)}
            className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink"
          >
            Falta / Cancelar
          </button>
        </div>
      )}

      {uiState === "aguardando" && showCancelForm && (
        <form
          className="flex flex-col gap-3"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await markMissedOrCancelled(appointment.id, formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setShowCancelForm(false);
            });
          }}
        >
          <select
            name="target_status"
            required
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          >
            <option value="">Status</option>
            {NEGATIVE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            name="reason"
            required
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          >
            <option value="">Motivo</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="reason_other"
            placeholder="Descreva o motivo (se 'Outro')"
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
            >
              {isPending ? "Salvando…" : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelForm(false)}
              className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink"
            >
              Voltar
            </button>
          </div>
        </form>
      )}

      {uiState === "em_atendimento" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction(() => checkOut(appointment.id))}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Registrando…" : "Check-out"}
        </button>
      )}

      {uiState === "realizada" && (
        <p className="text-sm text-status-positive-text">
          {appointment.checkinAt && appointment.checkoutAt
            ? `Sessão realizada — check-in ${formatTime(appointment.checkinAt)}, check-out ${formatTime(appointment.checkoutAt)}.`
            : "Sessão realizada."}
        </p>
      )}

      {uiState === "terminal_negativo" && (
        <div className="text-sm text-status-negative-text">
          <p>Motivo: {cancelReasonLabel(appointment.cancelReason)}</p>
          <p>Autor: {appointment.cancelledByName ?? "não informado"}</p>
        </div>
      )}

      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
