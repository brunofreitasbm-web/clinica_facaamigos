"use client";

import { useState, useTransition } from "react";
import { reassignQueueItem } from "./actions";

type CandidateProfile = { id: string; full_name: string };

/**
 * Reatribuição manual do dono de um item da fila (§9.1). `currentAssigneeId`
 * pode ser null quando o assignment ainda não terminou de ser criado
 * (corrida entre duas cargas concorrentes da fila — ver attachQueueAssignments
 * em lib/reception-queue.ts); nesse caso a recepção só recarrega a página.
 */
export function ReassignOwnerButton({
  itemId,
  currentAssigneeId,
  candidates,
}: {
  itemId: string;
  currentAssigneeId: string | null;
  candidates: CandidateProfile[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentAssigneeId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-ink-faint underline decoration-dotted hover:text-ink"
      >
        Reatribuir
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || !value}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await reassignQueueItem(itemId, value);
              if (result.success) setOpen(false);
              else setError(result.error);
            });
          }}
          className="rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-ink-faint hover:text-ink"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
    </div>
  );
}
