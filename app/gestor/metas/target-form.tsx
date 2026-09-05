"use client";

import { useMemo, useState, useTransition } from "react";
import { createTarget } from "./actions";
import { METRIC_CATALOG } from "@/lib/metric-catalog";
import type { Role } from "@/lib/roles";

export function TargetForm({ roles }: { roles: { value: Role; label: string }[] }) {
  const [role, setRole] = useState<Role>(roles[0]?.value ?? "recepcao");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const metrics = useMemo(() => METRIC_CATALOG[role] ?? [], [role]);

  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:items-end"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createTarget(formData);
          if (!result.success) setError(result.error ?? "Erro ao salvar.");
          else (document.getElementById("target-form") as HTMLFormElement | null)?.reset();
        });
      }}
      id="target-form"
    >
      <div className="col-span-2 sm:col-span-1">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Cargo</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
        >
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 sm:col-span-2">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Métrica</label>
        <select
          name="metric_key"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
        >
          {metrics.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
              {!m.computed ? " (sem cálculo ainda)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Período</label>
        <select
          name="period"
          defaultValue="mensal"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
        >
          <option value="mensal">Mensal</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Meta</label>
        <input
          name="target_value"
          type="number"
          step="0.01"
          required
          placeholder="ex.: 8"
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Peso (%)</label>
          <input
            name="weight"
            type="number"
            step="1"
            min="1"
            max="100"
            required
            placeholder="ex.: 20"
            className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Adicionar"}
        </button>
      </div>

      {error && <p className="col-span-full text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
