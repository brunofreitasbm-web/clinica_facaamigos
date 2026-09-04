"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCompetence } from "./actions";

export function CompetenceForm({ insurers }: { insurers: { id: string; name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:flex-row sm:items-end"
      action={(formData) => {
        setError(null);
        const insurerId = String(formData.get("insurer_id") ?? "");
        const month = String(formData.get("month") ?? "");
        startTransition(async () => {
          const result = await closeCompetence(insurerId, month);
          if (!result.success) {
            setError(result.error);
            return;
          }
          router.push(`/faturamento/competencias/${result.billingPeriodId}`);
        });
      }}
    >
      <div className="flex-1">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="insurer_id"
        >
          Convênio
        </label>
        <select
          id="insurer_id"
          name="insurer_id"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="" disabled>
            Selecione
          </option>
          {insurers.map((insurer) => (
            <option key={insurer.id} value={insurer.id}>
              {insurer.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:w-48">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="month">
          Competência
        </label>
        <input
          id="month"
          name="month"
          type="month"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {isPending ? "Fechando…" : "Fechar competência"}
      </button>
      {error && <p className="text-xs text-status-negative-text sm:basis-full">{error}</p>}
    </form>
  );
}
