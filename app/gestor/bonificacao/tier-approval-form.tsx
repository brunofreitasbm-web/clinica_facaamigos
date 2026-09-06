"use client";

import { useState, useTransition } from "react";
import { approveTherapistTierChange, rejectTherapistTierChange, type TierRow } from "./actions";

export function TierApprovalForm({ row }: { row: TierRow }) {
  const [mode, setMode] = useState<"none" | "promote" | "reject">("none");
  const [tier, setTier] = useState(row.tier === "sem contrato vigente" ? "" : row.tier);
  const [rate, setRate] = useState(row.currentRate ?? 0);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (doneMsg) {
    return <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ {doneMsg}</span>;
  }

  if (mode === "none") {
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setMode("promote")}
          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          ✓ Aprovar Faixa
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className="rounded-md bg-paper border border-paper-line px-2 py-1 text-xs font-medium text-ink-soft hover:bg-paper-subtle transition-colors"
        >
          ✕ Manter Faixa
        </button>
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <form
        className="flex flex-col items-end gap-1.5"
        action={() => {
          setError(null);
          const formData = new FormData();
          formData.set("profile_id", row.id);
          formData.set("justification", justification);
          startTransition(async () => {
            const result = await rejectTherapistTierChange(formData);
            if (result.success) {
              setDoneMsg("Manutenção de faixa registrada no audit log");
            } else {
              setError(result.error ?? "Erro ao registrar.");
            }
          });
        }}
      >
        <input
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Motivo da não-progressão (obrigatório)..."
          className="w-64 rounded border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink placeholder:text-ink-faint"
          required
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("none")}
            className="text-[11px] text-ink-soft underline"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !justification.trim()}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            {isPending ? "Gravando…" : "Confirmar Manutenção"}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </form>
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
            setDoneMsg("Nova faixa registrada com sucesso");
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
          placeholder="Nova faixa (ex.: Sênior)"
          className="w-36 rounded border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
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
          onClick={() => setMode("none")}
          className="text-[11px] text-ink-soft underline"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !tier.trim() || rate <= 0}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          {isPending ? "Gravando…" : "Confirmar Faixa"}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </form>
  );
}
