"use client";

import { useState, useTransition } from "react";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Botão genérico "marcar como concluído" pra pendências que só têm um
 * estado final sem sub-formulário (remarcação solicitada, documento da
 * família) — diferente de ResolveAutoFaltaButton, que tem dois caminhos
 * (definir motivo ou desfazer) e por isso ficou num componente próprio.
 */
export function ResolveSimpleButton({
  id,
  label,
  doneLabel,
  action,
}: {
  id: string;
  label: string;
  doneLabel: string;
  action: (id: string) => Promise<ActionResult>;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs font-medium text-status-positive-text">✓ {doneLabel}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action(id);
            if (result.success) setDone(true);
            else setError(result.error);
          });
        }}
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
      >
        {isPending ? "Salvando…" : label}
      </button>
      {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
    </div>
  );
}
