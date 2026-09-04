"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAppealed, registerRecovery } from "./actions";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function GlosaRowActions({
  glosaId,
  appealedAt,
  recoveredAmount,
  glosaAmount,
}: {
  glosaId: string;
  appealedAt: string | null;
  recoveredAmount: number | null;
  glosaAmount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleMarkAppealed() {
    setError(null);
    startTransition(async () => {
      const result = await markAppealed(glosaId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (recoveredAmount !== null) {
    return (
      <p className="text-xs font-medium text-status-positive-text">
        Recuperado: {currencyFormatter.format(recoveredAmount)}
      </p>
    );
  }

  if (!appealedAt) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleMarkAppealed}
          disabled={isPending}
          className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart disabled:opacity-50"
        >
          {isPending ? "Marcando…" : "Marcar como recursado"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-status-pending-text">
        Recursado em{" "}
        {new Date(appealedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
      </p>
      {!showRecoveryForm ? (
        <button
          type="button"
          onClick={() => setShowRecoveryForm(true)}
          className="self-start rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart"
        >
          Registrar recuperação
        </button>
      ) : (
        <form
          className="flex items-center gap-2"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await registerRecovery(glosaId, formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setShowRecoveryForm(false);
              router.refresh();
            });
          }}
        >
          <input
            type="number"
            name="recovered_amount"
            step="0.01"
            min="0.01"
            max={glosaAmount}
            inputMode="decimal"
            required
            placeholder="Valor recuperado"
            className="w-32 rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-chart px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setShowRecoveryForm(false)}
            className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink"
          >
            Cancelar
          </button>
        </form>
      )}
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
