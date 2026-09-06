"use client";

import { useTransition } from "react";
import { updateAlertStatus } from "./inbox-actions";

export type NpsAlertRow = {
  id: string;
  patientName: string;
  guardianName: string | null;
  score: number | null;
  feedbackText: string | null;
  alertStatus: "ok" | "pending_contact" | "em_atendimento" | "resolvido";
  dateLabel: string;
};

const STATUS_LABEL: Record<NpsAlertRow["alertStatus"], string> = {
  ok: "Ok",
  pending_contact: "Pendente de Contato",
  em_atendimento: "Em Atendimento",
  resolvido: "Resolvido",
};

const NEXT_STATUS: Record<NpsAlertRow["alertStatus"], NpsAlertRow["alertStatus"] | null> = {
  ok: null,
  pending_contact: "em_atendimento",
  em_atendimento: "resolvido",
  resolvido: null,
};

function AlertCard({ alert }: { alert: NpsAlertRow }) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = NEXT_STATUS[alert.alertStatus];

  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{alert.patientName}</p>
          {alert.guardianName && <p className="text-xs text-ink-soft">{alert.guardianName}</p>}
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-red-700">
          Nota {alert.score ?? "—"}
        </span>
      </div>

      {alert.feedbackText && <p className="text-sm text-ink-soft italic">&quot;{alert.feedbackText}&quot;</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-ink-faint">{alert.dateLabel}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-red-700">{STATUS_LABEL[alert.alertStatus]}</span>
          {nextStatus && (
            <button
              type="button"
              disabled={isPending}
              className="btn btn-secondary text-xs"
              onClick={() => {
                startTransition(() => {
                  updateAlertStatus(alert.id, nextStatus);
                });
              }}
            >
              Marcar como {STATUS_LABEL[nextStatus]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NpsAlertsPanel({ alerts }: { alerts: NpsAlertRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
        Alertas de Insatisfação
      </h6>

      {alerts.length === 0 && <p className="text-sm text-ink-faint">Nenhum alerta pendente. 🎉</p>}

      <div className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
