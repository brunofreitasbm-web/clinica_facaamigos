"use client";

import { useMemo, useState } from "react";
import type { TierRow } from "./data";

const PAGE_SIZE = 10;

type FilterKey = "todos" | "ativos" | "sem-contrato";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "ativos", label: "Ativos" },
  { key: "sem-contrato", label: "Sem contrato" },
];

export function TierProgressionTable({ rows }: { rows: TierRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (filter === "ativos") return rows.filter((r) => r.hasContract);
    if (filter === "sem-contrato") return rows.filter((r) => !r.hasContract);
    return rows;
  }, [rows, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const handleFilter = (key: FilterKey) => {
    setFilter(key);
    setPage(0);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar terapeutas">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => handleFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-paper-subtle text-ink-soft hover:bg-blue-100 hover:text-blue-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-faint">
          {filtered.length} terapeuta{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <table className="table" aria-label="Tabela de progressão de faixa de terapeutas">
        <caption className="sr-only">
          Progressão de faixa dos terapeutas, com sessões nos últimos 90 dias e elegibilidade para a próxima faixa.
        </caption>
        <thead>
          <tr>
            <th>Terapeuta</th>
            <th>Faixa</th>
            <th>Sessões (90d)</th>
            <th>Evolução em 24h</th>
            <th>Próxima faixa</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((t) => (
            <tr key={t.id}>
              <td className="font-semibold">{t.name}</td>
              <td>
                {t.hasContract ? (
                  t.tier
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                    Sem contrato
                  </span>
                )}
              </td>
              <td className="tabular-figure">
                {t.sessions > 0 ? t.sessions : <span className="text-ink-faint">—</span>}
              </td>
              <td className="tabular-figure">
                {t.hasSessions ? t.note24hRateLabel : <span className="text-ink-faint">—</span>}
              </td>
              <td>
                {t.eligible ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    {t.nextTierLabel}
                  </span>
                ) : (
                  <span className="text-ink-faint">{t.nextTierLabel}</span>
                )}
              </td>
            </tr>
          ))}
          {pageRows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-ink-faint">
                {rows.length === 0 ? "Nenhum terapeuta ativo cadastrado ainda." : "Nenhum terapeuta corresponde ao filtro selecionado."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-ink-soft">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="rounded-md border px-2.5 py-1 font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-divider)" }}
          >
            Anterior
          </button>
          <span className="tabular-figure">
            Página {clampedPage + 1} de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
            className="rounded-md border px-2.5 py-1 font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-divider)" }}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
