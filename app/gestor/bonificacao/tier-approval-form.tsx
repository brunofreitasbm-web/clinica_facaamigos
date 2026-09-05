"use client";

import { useState, useTransition } from "react";
import { approveTherapistTierChange, type TierRow } from "./actions";

export function TierApprovalForm({ row }: { row: TierRow }) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState(row.tier === "sem contrato vigente" ? "" : row.tier);
  const [rate, setRate] = useState(row.currentRate ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs font-medium text-status-positive-text">✓ Nova faixa registrada</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
      >
        ✓ Propor promoção
      </button>
    );
  }

  return (
    <form
      className="flex flex-col items-end gap-1.5"
      action={() => {
        setError(null);
        const formData = new FormData();
        formData.set("profile_id", row.id);
        formData.set("tier", tier);
        formData.set("proposed_rate", String(rate));
        startTransition(async () => {
          const result = await approveTherapistTierChange(formData);
          if (result.success) {
            setDone(true);
          } else {
            setError(result.error ?? "Erro ao gravar.");
          }
        });
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          placeholder="Nova faixa (ex.: Faixa 2 · Sênior)"
          className="w-44 rounded border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
        />
        <span className="text-xs text-ink-soft">R$</span>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-20 rounded border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-ink-soft underline"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !tier.trim() || rate <= 0}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          {isPending ? "Gravando…" : "Confirmar"}
        </button>
      </div>
      {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
    </form>
  );
}
