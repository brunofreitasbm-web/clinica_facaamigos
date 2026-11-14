"use client";

import { useState, useTransition } from "react";
import { approveRescheduling, rejectRescheduling } from "./actions";

/**
 * Aprovar é a ação primária. Recusar pede uma confirmação (dois passos) e avisa que a
 * família não recebe mensagem automática: quem recusa precisa avisar.
 */
export function DecisionButtons({ appointmentId }: { appointmentId: string }) {
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(appointmentId);
      if (!result.success) setError(result.error);
    });
  }

  if (confirmingReject) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="m-0 max-w-xs text-right text-xs text-ink-soft">
          O horário será cancelado com motivo registrado. A família não é avisada pelo sistema: avise por WhatsApp.
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={isPending} onClick={() => setConfirmingReject(false)} className="btn btn-secondary text-sm">
            Voltar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(rejectRescheduling)}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Recusando…" : "Confirmar recusa"}
          </button>
        </div>
        {error && <p className="m-0 text-xs text-status-negative-text">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirmingReject(true)}
          className="rounded bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
        >
          Recusar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(approveRescheduling)}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Aprovando…" : "Aprovar data"}
        </button>
      </div>
      {error && <p className="m-0 text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
