"use client";

import { useState, useTransition } from "react";
import { registerFirstContact } from "../actions";

export function RegisterContactButton({ patientId }: { patientId: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs font-medium text-status-positive-text">✓ Retorno registrado</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await registerFirstContact(patientId);
            if (result.success) setDone(true);
            else setError(result.error ?? "Erro ao registrar.");
          });
        }}
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
      >
        {isPending ? "Registrando…" : "Marcar retorno feito"}
      </button>
      {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
    </div>
  );
}
