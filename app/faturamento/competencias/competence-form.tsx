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
      className="card flex flex-col gap-4 sm:flex-row sm:items-end"
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
      <div className="field flex-1">
        <label htmlFor="insurer_id">Convênio</label>
        <select id="insurer_id" name="insurer_id" required defaultValue="" className="input">
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
      <div className="field sm:w-48">
        <label htmlFor="month">Competência</label>
        <input id="month" name="month" type="month" required className="input" />
      </div>
      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Fechando…" : "Fechar competência"}
      </button>
      {error && (
        <p className="text-xs sm:basis-full" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
