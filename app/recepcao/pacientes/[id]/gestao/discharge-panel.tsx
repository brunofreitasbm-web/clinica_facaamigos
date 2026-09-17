"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { reactivatePatient } from "./actions";

export type DischargedAppointmentRow = {
  id: string;
  startsAtLabel: string;
  therapistName: string;
};

export type DischargeInfo = {
  dischargedAtLabel: string;
  reason: string | null;
  cancelledAppointments: DischargedAppointmentRow[];
};

/**
 * Só renderizado quando `patients.discharged_auto = true` (ver gestao/
 * page.tsx) — o desligamento em si já aconteceu no banco via trigger
 * `trg_appointments_auto_discharge` (2 faltas consecutivas sem
 * justificativa aprovada, FASE 5). Este painel só expõe o que aconteceu e
 * permite reverter: reativar o paciente (RPC `reactivate_discharged_
 * patient`) e, depois, ir gerar a grade de novo na Supervisão — a
 * reativação não recria sessões sozinha.
 */
export function DischargePanel({ patientId, info }: { patientId: string; info: DischargeInfo }) {
  const [error, setError] = useState<string | null>(null);
  const [reactivated, setReactivated] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleReactivate() {
    setError(null);
    startTransition(async () => {
      const result = await reactivatePatient(patientId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReactivated(true);
    });
  }

  return (
    <div className="card max-w-[720px] gap-3" style={{ borderColor: "var(--color-error)" }}>
      <div className="card-kicker" style={{ color: "var(--color-error)" }}>
        Desligamento automático
      </div>

      {reactivated ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-status-positive-text">
            ✓ Paciente reativado. A grade fixa antiga não volta sozinha — regere as sessões na grade da Supervisão.
          </p>
          <Link href="/supervisao" className="btn btn-secondary text-xs w-fit">
            Ir para a grade (Supervisão) e regerar
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Desligado automaticamente em <strong>{info.dischargedAtLabel}</strong> por 2 faltas consecutivas sem
            justificativa aprovada.
            {info.reason && <> Motivo registrado: {info.reason}.</>}
          </p>

          {info.cancelledAppointments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Sessões futuras canceladas pelo desligamento
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {info.cancelledAppointments.map((a) => (
                  <li key={a.id} className="text-ink-soft">
                    {a.startsAtLabel} · {a.therapistName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <button type="button" disabled={isPending} className="btn btn-primary text-xs" onClick={handleReactivate}>
              {isPending ? "Reativando…" : "Reativar paciente"}
            </button>
          </div>

          {error && <p className="text-xs text-status-negative-text">{error}</p>}
        </>
      )}
    </div>
  );
}
