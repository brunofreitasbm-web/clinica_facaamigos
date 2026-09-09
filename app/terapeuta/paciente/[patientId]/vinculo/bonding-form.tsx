"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBondingReport } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-base text-ink md:min-h-11";

export function BondingForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveBondingReport(patientId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-xl flex-col gap-4 md:max-w-2xl">
      <div className="flex gap-3">
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-ink-soft">Período · início</label>
          <input type="date" name="period_start" required className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-ink-soft">Período · fim</label>
          <input type="date" name="period_end" required className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-ink-soft">
          Nível de engajamento observado (1-5)
        </label>
        <input type="number" name="engagement_score" min={1} max={5} required className={`${inputClass} max-w-[100px]`} />
      </div>
      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-ink-soft">O que foi observado</label>
        <textarea name="observations" rows={3} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-base text-ink">
        <input type="checkbox" name="ready_to_increase_demands" /> A equipe entende que pode aumentar demandas
      </label>
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary self-start">
          {isPending ? "Salvando…" : "Salvar registro de vínculo"}
        </button>
        {error && <p className="text-sm text-status-negative-text">{error}</p>}
      </div>
    </form>
  );
}
