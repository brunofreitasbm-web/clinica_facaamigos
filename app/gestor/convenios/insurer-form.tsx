"use client";

import { useState, useTransition } from "react";
import { createInsurer } from "./actions";

export function InsurerForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:flex-row sm:items-end"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createInsurer(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          (document.getElementById("insurer-form") as HTMLFormElement)?.reset();
        });
      }}
      id="insurer-form"
    >
      <div className="flex-1">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="name">
          Nome do convênio
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-40">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="ans_code">
          Código ANS
        </label>
        <input
          id="ans_code"
          name="ans_code"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-48">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="provider_code">
          Código do prestador
        </label>
        <input
          id="provider_code"
          name="provider_code"
          placeholder="credenciamento na operadora"
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
