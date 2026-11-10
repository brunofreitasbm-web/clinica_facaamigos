"use client";

import { INTAKE_GROUP_ORDER, type IntakeGroup } from "../../../lib/intake-queue-pure.ts";

export const INTAKE_TAB_LABEL: Record<IntakeGroup, string> = {
  agir_agora: "Agir agora",
  aguardando_familia: "Aguardando família",
  aguardando_plano: "Aguardando plano",
  concluidos: "Concluídos",
};

/** As 4 abas da Fila de entrada, cada uma com a contagem de casos. */
export function IntakeTabs({
  counts,
  active,
  onChange,
}: {
  counts: Record<IntakeGroup, number>;
  active: IntakeGroup;
  onChange: (group: IntakeGroup) => void;
}) {
  return (
    <div role="tablist" aria-label="Etapas da fila de entrada" className="flex flex-wrap gap-1 border-b border-slate-200">
      {INTAKE_GROUP_ORDER.map((group) => {
        const selected = group === active;
        return (
          <button
            key={group}
            type="button"
            role="tab"
            id={`intake-tab-${group}`}
            aria-selected={selected}
            aria-controls="intake-tabpanel"
            onClick={() => onChange(group)}
            className={`-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
              selected
                ? "border-teal-600 text-slate-900"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            <span>{INTAKE_TAB_LABEL[group]}</span>
            <span
              className={`rounded-full px-2 text-sm tabular-nums ${selected ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {counts[group]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
