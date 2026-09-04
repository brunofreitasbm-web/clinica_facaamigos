"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGlosa } from "./actions";

export type EligibleBillingItem = {
  id: string;
  procedureCode: string;
  amount: number;
  startsAt: string | null;
  patientName: string;
  therapistName: string;
  guideNumber: string | null;
  cardNumber: string | null;
};

export type Therapist = { id: string; fullName: string };

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ATTRIBUTABLE_OPTIONS: { value: string; label: string }[] = [
  { value: "terapeuta", label: "Terapeuta" },
  { value: "recepcao", label: "Recepção" },
  { value: "faturamento", label: "Faturamento" },
  { value: "operadora", label: "Operadora" },
];

export function GlosaRegisterForm({
  items,
  therapists,
  searched,
}: {
  items: EligibleBillingItem[];
  therapists: Therapist[];
  searched: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attributableTo, setAttributableTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const selected = items.find((i) => i.id === selectedId) ?? null;

  if (searched && items.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        Nenhum item elegível (status &quot;enviado&quot;) encontrado para essa busca.
      </p>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-paper-line-strong px-3 py-2 text-sm hover:border-chart has-[:checked]:border-chart has-[:checked]:bg-chart/5">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="selected_item"
                  value={item.id}
                  checked={selectedId === item.id}
                  onChange={() => setSelectedId(item.id)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-ink">{item.patientName}</span>
              </span>
              <span className="text-ink-soft">{item.procedureCode}</span>
              <span className="text-ink-faint">Guia: {item.guideNumber ?? "—"}</span>
              <span className="text-ink-faint">{item.therapistName}</span>
              <span className="tabular-figure font-medium text-ink">{currencyFormatter.format(item.amount)}</span>
            </label>
          </li>
        ))}
      </ul>

      {selected && (
        <form
          className="grid grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper p-4 sm:grid-cols-2"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createGlosa(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setSelectedId(null);
              setAttributableTo("");
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="billing_item_id" value={selected.id} />

          <div className="sm:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="reason_code">
              Código do motivo
            </label>
            <input
              id="reason_code"
              name="reason_code"
              required
              placeholder="Ex: código TISS do convênio"
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="reason_text">
              Descrição do motivo (opcional)
            </label>
            <input
              id="reason_text"
              name="reason_text"
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="amount">
              Valor glosado (R$)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={selected.amount}
              inputMode="decimal"
              required
              defaultValue={selected.amount}
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            />
            <p className="mt-1 text-xs text-ink-faint">
              Valor do item: {currencyFormatter.format(selected.amount)} — glosa parcial é permitida.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="attributable_to">
              Atribuir a
            </label>
            <select
              id="attributable_to"
              name="attributable_to"
              required
              value={attributableTo}
              onChange={(e) => setAttributableTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                Selecione
              </option>
              {ATTRIBUTABLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {attributableTo === "terapeuta" && (
            <div className="sm:col-span-2">
              <label
                className="text-xs font-medium uppercase tracking-wide text-ink-soft"
                htmlFor="attributable_profile_id"
              >
                Terapeuta responsável
              </label>
              <select
                id="attributable_profile_id"
                name="attributable_profile_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
            >
              {isPending ? "Registrando…" : "Registrar glosa"}
            </button>
            {error && <p className="text-xs text-status-negative-text">{error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
