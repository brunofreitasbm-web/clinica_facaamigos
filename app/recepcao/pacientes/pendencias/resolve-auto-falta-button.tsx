"use client";

import { useState, useTransition } from "react";
import { setAutoFaltaReason, undoAutoFalta } from "../../agenda/session-actions";
import { CANCEL_REASONS } from "@/lib/appointment-cancel-reasons";

/**
 * Ação da fila de pendências pra falta marcada automaticamente (rotina
 * auto_resolve_appointments — sem check-in até 20 min depois do início).
 * Duas saídas: registrar o motivo real (mantém a falta) ou desfazer (a
 * família chegou/o check-in falhou por outro motivo) — mesma dupla de ações
 * disponível na agenda do dia (today-agenda-list.tsx).
 */
export function ResolveAutoFaltaButton({ appointmentId }: { appointmentId: string }) {
  const [mode, setMode] = useState<"idle" | "reason">("idle");
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0].value);
  const [reasonOther, setReasonOther] = useState("");
  const [done, setDone] = useState<"motivo" | "desfeita" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done === "motivo") {
    return <span className="text-xs font-medium text-status-positive-text">✓ Motivo registrado</span>;
  }
  if (done === "desfeita") {
    return <span className="text-xs font-medium text-status-positive-text">✓ Falta desfeita</span>;
  }

  if (mode === "reason") {
    return (
      <form
        className="flex flex-col items-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const formData = new FormData();
          formData.set("reason", reason);
          formData.set("reason_other", reasonOther);
          startTransition(async () => {
            const result = await setAutoFaltaReason(appointmentId, formData);
            if (result.success) setDone("motivo");
            else setError(result.error ?? "Erro ao registrar.");
          });
        }}
      >
        <div className="flex items-center gap-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs"
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {reason === "outro" && (
          <input
            value={reasonOther}
            onChange={(e) => setReasonOther(e.target.value)}
            placeholder="Descreva o motivo"
            className="w-full rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs"
          />
        )}
        {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("reason")}
          className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-subtle"
        >
          Definir motivo
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await undoAutoFalta(appointmentId);
              if (result.success) setDone("desfeita");
              else setError(result.error ?? "Erro ao desfazer.");
            });
          }}
          className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
        >
          {isPending ? "Desfazendo…" : "Desfazer falta"}
        </button>
      </div>
      {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
    </div>
  );
}
