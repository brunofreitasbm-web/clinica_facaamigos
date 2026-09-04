"use client";

import { useState, useTransition } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { computeAppointmentUiState, UI_STATE_LABEL } from "@/lib/appointment-ui-state";
import { startAttendance } from "./session-actions";

export type TodaySession = {
  id: string;
  startsAt: string;
  patientName: string;
  status: string;
  checkinAt: string | null;
  attendanceStartedAt: string | null;
  checkoutAt: string | null;
};

export function TodaySessionsList({ sessions }: { sessions: TodaySession[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function handleStart(id: string) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    startTransition(async () => {
      const result = await startAttendance(id);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, [id]: result.error }));
      }
    });
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-ink-faint">Nenhuma sessão hoje.</p>;
  }

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {sessions.map((a) => {
        const uiState = computeAppointmentUiState(a);
        return (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium text-ink">{a.patientName}</span>
              <span className="ml-2 text-ink-faint">
                {new Date(a.startsAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: CLINIC_TIMEZONE,
                })}
              </span>
              <span className="ml-2 rounded-full bg-status-neutral-soft px-2 py-0.5 text-xs font-medium text-status-neutral-text">
                {UI_STATE_LABEL[uiState]}
              </span>
              {errors[a.id] && <p className="mt-1 text-xs text-status-negative-text">{errors[a.id]}</p>}
            </div>
            {uiState === "na_recepcao" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStart(a.id)}
                className="shrink-0 rounded-md bg-chart px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
              >
                {isPending ? "Iniciando…" : "Iniciar atendimento"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
