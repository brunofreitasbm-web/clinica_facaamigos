"use client";

import { useState, useTransition } from "react";
import { formatBRL, packageTotal } from "@/lib/specialty-prices";
import { upsertSpecialtyPrice, toggleSpecialtyPrice, updateDefaultSessionsPerMonth } from "./actions";

export type SpecialtyPriceViewRow = {
  id: string | null;
  specialtyValue: string;
  specialtyLabel: string;
  price: number | null;
  durationMinutes: number;
  active: boolean;
};

function SpecialtyPriceRowView({ row }: { row: SpecialtyPriceViewRow }) {
  const [editing, setEditing] = useState(row.price == null);
  const [price, setPrice] = useState(row.price != null ? String(row.price) : "");
  const [duration, setDuration] = useState(String(row.durationMinutes));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("specialty_value", row.specialtyValue);
      fd.set("price", price);
      fd.set("duration_minutes", duration);
      const result = await upsertSpecialtyPrice(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  };

  return (
    <tr>
      <td className={row.active ? "" : "text-ink-faint line-through"}>{row.specialtyLabel}</td>
      <td>
        {editing ? (
          <input
            className="input w-28"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        ) : (
          <span className="tabular-nums">{row.price != null ? formatBRL(row.price) : "—"}</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="input w-20"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        ) : (
          <span className="tabular-nums">{row.durationMinutes} min</span>
        )}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <button type="button" className="btn btn-secondary" disabled={isPending} onClick={save}>
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              {row.price != null && (
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
                Editar
              </button>
              {row.id && (
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      void toggleSpecialtyPrice(row.id as string, !row.active);
                    })
                  }
                >
                  {row.active ? "Desativar" : "Reativar"}
                </button>
              )}
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
      </td>
    </tr>
  );
}

export function PrecosTable({
  rows,
  defaultSessionsPerMonth,
}: {
  rows: SpecialtyPriceViewRow[];
  defaultSessionsPerMonth: number;
}) {
  const [sessions, setSessions] = useState(String(defaultSessionsPerMonth));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <table className="table mb-6">
        <thead>
          <tr>
            <th>Especialidade</th>
            <th>Preço / sessão</th>
            <th>Duração</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SpecialtyPriceRowView key={row.specialtyValue} row={row} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-ink-faint">
                Nenhuma especialidade ativa cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form
        className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:flex-row sm:items-end sm:flex-wrap max-w-[520px]"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await updateDefaultSessionsPerMonth(formData);
            if (!result.success) {
              setError(result.error);
            }
          });
        }}
      >
        <div className="flex-1">
          <label
            className="text-xs font-medium uppercase tracking-wide text-ink-soft"
            htmlFor="default_sessions_per_month"
          >
            Nº de sessões do pacote mensal adiantado
          </label>
          <input
            id="default_sessions_per_month"
            name="default_sessions_per_month"
            type="number"
            min={1}
            required
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
            className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
          {isPending ? "Salvando…" : "Salvar"}
        </button>
        {error && <p className="text-xs text-status-negative-text sm:basis-full">{error}</p>}
      </form>

      {rows.some((r) => r.price != null) && (
        <p className="mt-3 text-xs text-ink-faint max-w-[520px]">
          Exemplo de pacote mensal ({sessions || defaultSessionsPerMonth} sessões):{" "}
          {rows
            .filter((r) => r.price != null && r.active)
            .slice(0, 1)
            .map((r) => (
              <span key={r.specialtyValue}>
                {r.specialtyLabel} = {formatBRL(packageTotal(r.price as number, Number(sessions) || defaultSessionsPerMonth))}
              </span>
            ))}
        </p>
      )}
    </>
  );
}
