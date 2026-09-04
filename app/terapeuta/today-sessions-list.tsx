"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import {
  computeAppointmentUiState,
  UI_STATE_LABEL,
  type AppointmentUiState,
} from "@/lib/appointment-ui-state";
import { startAttendance, checkOut } from "./session-actions";

export type TodaySession = {
  id: string;
  startsAt: string;
  endsAt: string;
  discipline: string;
  roomName: string | null;
  patientName: string;
  status: string;
  checkinAt: string | null;
  attendanceStartedAt: string | null;
  checkoutAt: string | null;
};

// Cor do tag-status pra cada estado de UI (derivado, não é appointments.status
// — ver lib/appointment-ui-state.ts). Reaproveita as mesmas classes globais
// usadas pra status real (.st-*) porque a paleta é a mesma.
const UI_STATE_TAG_CLASS: Record<AppointmentUiState, string> = {
  aguardando: "st-agendada",
  na_recepcao: "st-confirmada",
  em_atendimento: "st-em-atendimento",
  realizada: "st-realizada",
  terminal_negativo: "st-cancelada",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

export function TodaySessionsList({
  sessions,
  pendingNoteIds,
}: {
  sessions: TodaySession[];
  pendingNoteIds: string[];
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pendingSet = new Set(pendingNoteIds);

  function runAction(id: string, action: (id: string) => Promise<{ success: boolean; error?: string }>) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setPendingId(id);
    startTransition(async () => {
      const result = await action(id);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, [id]: result.error ?? "Não foi possível concluir." }));
      }
      setPendingId(null);
    });
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-ink-faint">Nenhuma sessão hoje.</p>;
  }

  const withState = sessions.map((s) => ({ ...s, ui: computeAppointmentUiState(s) }));
  const currentIdx = withState.findIndex((s) => s.ui === "em_atendimento" || s.ui === "na_recepcao");
  const current = currentIdx >= 0 ? withState[currentIdx] : (withState.find((s) => s.ui === "aguardando") ?? null);
  const upcoming = withState.filter((s) => s.id !== current?.id);

  return (
    <div className="flex flex-col gap-7">
      {current && (
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Agora
          </h6>
          <div className="card elev-sm" style={{ background: "#fff", padding: 18, gap: 14 }}>
            <div className="flex items-start justify-between">
              <div>
                <div style={{ fontFamily: "var(--font-heading)" }} className="text-xl font-semibold">
                  {current.patientName}
                </div>
                <div className="text-[13px] text-ink-soft">
                  {current.discipline}
                  {current.roomName ? ` · ${current.roomName}` : ""} · {fmtTime(current.startsAt)} –{" "}
                  {fmtTime(current.endsAt)}
                </div>
              </div>
              <span className={`tag-status ${UI_STATE_TAG_CLASS[current.ui]}`}>
                {UI_STATE_LABEL[current.ui]}
              </span>
            </div>

            <div className="flex gap-2.5">
              {current.ui === "na_recepcao" && (
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  style={{ minHeight: 48, fontSize: 15 }}
                  disabled={isPending && pendingId === current.id}
                  onClick={() => runAction(current.id, startAttendance)}
                >
                  {isPending && pendingId === current.id ? "Iniciando…" : "Iniciar atendimento"}
                </button>
              )}
              {current.ui === "em_atendimento" && (
                <>
                  <Link
                    href={`/terapeuta/evolucao/${current.id}`}
                    className="btn btn-gold flex-1"
                    style={{ minHeight: 48, fontSize: 15 }}
                  >
                    Registrar evolução
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: 48 }}
                    disabled={isPending && pendingId === current.id}
                    onClick={() => runAction(current.id, checkOut)}
                  >
                    {isPending && pendingId === current.id ? "Fechando…" : "Check-out"}
                  </button>
                </>
              )}
              {current.ui === "realizada" && pendingSet.has(current.id) && (
                <Link
                  href={`/terapeuta/evolucao/${current.id}`}
                  className="btn btn-gold flex-1"
                  style={{ minHeight: 48, fontSize: 15 }}
                >
                  Registrar evolução
                </Link>
              )}
              {current.ui === "aguardando" && (
                <p className="text-sm text-ink-faint">Aguardando check-in na recepção.</p>
              )}
            </div>
            {errors[current.id] && (
              <p className="text-xs text-status-negative-text">{errors[current.id]}</p>
            )}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Próximas
          </h6>
          <div className="flex flex-col">
            {upcoming.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b py-3.5"
                style={{ borderColor: "var(--color-divider)" }}
              >
                <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
                  {fmtTime(s.startsAt)}
                </span>
                <span>
                  <span className="text-[15px] font-semibold">{s.patientName}</span>
                  <br />
                  <span className="text-xs text-ink-faint">
                    {s.discipline}
                    {s.roomName ? ` · ${s.roomName}` : ""}
                  </span>
                </span>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`tag-status ${UI_STATE_TAG_CLASS[s.ui]}`}>{UI_STATE_LABEL[s.ui]}</span>
                  {s.ui === "na_recepcao" && (
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      disabled={isPending && pendingId === s.id}
                      onClick={() => runAction(s.id, startAttendance)}
                    >
                      {isPending && pendingId === s.id ? "Iniciando…" : "Iniciar"}
                    </button>
                  )}
                  {s.ui === "realizada" && pendingSet.has(s.id) && (
                    <Link href={`/terapeuta/evolucao/${s.id}`} className="btn btn-ghost text-xs">
                      Evoluir
                    </Link>
                  )}
                </div>
                {errors[s.id] && (
                  <p className="col-span-3 text-xs text-status-negative-text">{errors[s.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
