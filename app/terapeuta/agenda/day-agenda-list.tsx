"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import {
  computeAppointmentUiState,
  UI_STATE_LABEL,
  type AppointmentUiState,
} from "@/lib/appointment-ui-state";
import { startAttendance, checkOut } from "../session-actions";

export type DaySession = {
  id: string;
  patientId: string;
  isEvaluation: boolean;
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

// Mesmo mapa de app/terapeuta/today-sessions-list.tsx — reaproveita as
// classes .st-* globais porque a paleta de estado de UI é a mesma.
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

/**
 * Lista de sessões de um dia qualquer da agenda (`/terapeuta/agenda?view=dia`).
 * Difere de app/terapeuta/today-sessions-list.tsx (que fica intocada) por ser
 * endereçável a qualquer data: `isToday` decide se os botões de ação
 * (iniciar/check-out/evoluir) aparecem, ou se a sessão só linka pra ficha do
 * paciente — não faz sentido "iniciar atendimento" numa sessão de outro dia.
 */
export function DayAgendaList({
  sessions,
  pendingNoteIds,
  isToday,
}: {
  sessions: DaySession[];
  pendingNoteIds: string[];
  isToday: boolean;
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
    return <p className="text-sm text-ink-faint">Nenhuma sessão neste dia.</p>;
  }

  const withState = sessions.map((s) => ({ ...s, ui: computeAppointmentUiState(s) }));

  return (
    <div className="flex flex-col">
      {withState.map((s) => {
        const isPendingNote = s.ui === "realizada" && pendingSet.has(s.id);
        return (
          <div
            key={s.id}
            className="flex flex-col gap-2 border-b py-3.5 md:py-4"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3 md:gap-4">
              <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold md:text-lg">
                {fmtTime(s.startsAt)}
              </span>
              <span>
                <span className="text-[15px] font-semibold md:text-base">{s.patientName}</span>
                <br />
                <span className="text-xs text-ink-faint md:text-sm">
                  {s.discipline}
                  {s.roomName ? ` · ${s.roomName}` : ""}
                </span>
              </span>
              <span className={`tag-status ${UI_STATE_TAG_CLASS[s.ui]}`}>{UI_STATE_LABEL[s.ui]}</span>
            </div>

            {isToday ? (
              <div className="flex gap-2.5 pl-[64px]">
                {s.ui === "na_recepcao" && (
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    style={{ minHeight: 48 }}
                    disabled={isPending && pendingId === s.id}
                    onClick={() => runAction(s.id, startAttendance)}
                  >
                    {isPending && pendingId === s.id ? "Iniciando…" : "Iniciar atendimento"}
                  </button>
                )}
                {s.isEvaluation && (s.ui === "na_recepcao" || s.ui === "em_atendimento") && (
                  <Link
                    href={`/terapeuta/paciente/${s.patientId}/anamnese`}
                    className="btn btn-gold text-xs"
                    style={{ minHeight: 48 }}
                  >
                    Registrar 1ª avaliação
                  </Link>
                )}
                {s.ui === "em_atendimento" && (
                  <>
                    <Link
                      href={`/terapeuta/evolucao/${s.id}?voltar=agenda`}
                      className="btn btn-gold text-xs"
                      style={{ minHeight: 48 }}
                    >
                      Registrar evolução
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      style={{ minHeight: 48 }}
                      disabled={isPending && pendingId === s.id}
                      onClick={() => runAction(s.id, checkOut)}
                    >
                      {isPending && pendingId === s.id ? "Fechando…" : "Check-out"}
                    </button>
                  </>
                )}
                {isPendingNote && (
                  <Link
                    href={`/terapeuta/evolucao/${s.id}?voltar=agenda`}
                    className="btn btn-gold text-xs"
                    style={{ minHeight: 48 }}
                  >
                    Registrar evolução
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex gap-2.5 pl-[64px]">
                {isPendingNote && (
                  <Link
                    href={`/terapeuta/evolucao/${s.id}?voltar=agenda`}
                    className="btn btn-ghost text-xs"
                  >
                    Registrar evolução
                  </Link>
                )}
                <Link href={`/terapeuta/paciente/${s.patientId}`} className="btn btn-ghost text-xs">
                  Ver ficha
                </Link>
              </div>
            )}

            {errors[s.id] && <p className="pl-[64px] text-xs text-status-negative-text">{errors[s.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}
