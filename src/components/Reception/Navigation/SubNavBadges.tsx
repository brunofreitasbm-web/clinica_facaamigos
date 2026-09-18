"use client";

import React from "react";

export type ConversationFilter = "abertas" | "aguardando" | "nao_lidas" | "leads" | "minhas" | "encerradas";

export interface FilterOption {
  key: ConversationFilter;
  label: string;
}

export const DEFAULT_FILTERS: FilterOption[] = [
  { key: "abertas", label: "Abertas" },
  { key: "aguardando", label: "Aguardando" },
  { key: "nao_lidas", label: "Não lidas" },
  { key: "leads", label: "Leads" },
  { key: "minhas", label: "Minhas" },
  { key: "encerradas", label: "Encerradas" },
];

interface SubNavBadgesProps {
  currentFilter: ConversationFilter;
  counts: Record<ConversationFilter, number>;
  onFilterChange: (filter: ConversationFilter) => void;
  filters?: FilterOption[];
}

export function SubNavBadges({
  currentFilter,
  counts,
  onFilterChange,
  filters = DEFAULT_FILTERS,
}: SubNavBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtros da Fila de Atendimento">
      {filters.map((f) => {
        const isActive = f.key === currentFilter;
        const count = counts[f.key] ?? 0;
        const isAlert = f.key === "aguardando" && count > 0;

        return (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Filtro ${f.label}: ${count} conversas`}
            onClick={() => onFilterChange(f.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-1 ${
              isActive
                ? "bg-slate-900 text-white shadow-sm border border-slate-900 dark:bg-slate-100 dark:text-slate-950"
                : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive
                  ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900"
                  : isAlert
                  ? "bg-red-600 text-white"
                  : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
