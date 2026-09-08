"use client";

import { useState, useTransition } from "react";
import { createPriceTableEntry } from "./actions";

export function PriceTableForm({ insurerId }: { insurerId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:flex-row sm:items-end sm:flex-wrap"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createPriceTableEntry(insurerId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          (document.getElementById("price-table-form") as HTMLFormElement)?.reset();
        });
      }}
      id="price-table-form"
    >
      <div className="sm:w-32">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="procedure_code"
        >
          Código
        </label>
        <input
          id="procedure_code"
          name="procedure_code"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex-1">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="procedure_name"
        >
          Nome do procedimento
        </label>
        <input
          id="procedure_name"
          name="procedure_name"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-32">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="price">
          Preço (R$)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          step="0.01"
          inputMode="decimal"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-40">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="valid_from"
        >
          Vigência (início)
        </label>
        <input
          id="valid_from"
          name="valid_from"
          type="date"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-40">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="valid_to"
        >
          Vigência (fim)
        </label>
        <input
          id="valid_to"
          name="valid_to"
          type="date"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Adicionar"}
      </button>
      {error && <p className="text-xs text-status-negative-text sm:basis-full">{error}</p>}
    </form>
  );
}
