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
      <div className="sm:w-28">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="duration_minutes"
        >
          Duração (min)
        </label>
        <input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min="1"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-36">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="max_sessions_per_guide"
        >
          Sessões por guia
        </label>
        <input
          id="max_sessions_per_guide"
          name="max_sessions_per_guide"
          type="number"
          min="1"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-36">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="medical_order_validity_months"
        >
          Pedido médico válido (meses)
        </label>
        <input
          id="medical_order_validity_months"
          name="medical_order_validity_months"
          type="number"
          min="1"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="sm:w-36">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="guide_validity_days"
        >
          Guia válida (dias)
        </label>
        <input
          id="guide_validity_days"
          name="guide_validity_days"
          type="number"
          min="1"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex items-center gap-2 sm:w-48">
        <input
          id="requires_prior_authorization"
          name="requires_prior_authorization"
          type="checkbox"
          defaultChecked
          className="h-4 w-4"
        />
        <label className="text-xs font-medium text-ink-soft" htmlFor="requires_prior_authorization">
          Exige autorização prévia
        </label>
      </div>
      <div className="flex-1 sm:min-w-64">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="session_frequency_note"
        >
          Regra de frequência (alerta)
        </label>
        <input
          id="session_frequency_note"
          name="session_frequency_note"
          placeholder="Ex.: limitado a 1 sessão/semana"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex-1 sm:min-w-64">
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="escalation_rule"
        >
          Escada de exigências (alerta)
        </label>
        <input
          id="escalation_rule"
          name="escalation_rule"
          placeholder="Ex.: acima de 20 sessões exige reavaliação médica"
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
