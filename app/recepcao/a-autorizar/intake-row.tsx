"use client";

import { highlightSegments } from "../pacientes/pendencias/queue-filters-pure.ts";
import { waitLabel } from "./intake-filters-pure.ts";

export type IntakeRowItem = {
  id: string;
  name: string;
  /** Ex.: "2 de 4 · Enviar guia". */
  stageLabel: string;
  waitingSince: string;
};

/** Linha da fila: nome, etapa ("2 de 4 · Enviar guia") e há quanto tempo espera. Só atrasado ganha cor. */
export function IntakeRow({
  item,
  search,
  now,
  overdue,
  selected,
  onSelect,
  buttonRef,
}: {
  item: IntakeRowItem;
  search: string;
  now: Date;
  overdue: boolean;
  selected: boolean;
  onSelect: () => void;
  buttonRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={buttonRef as unknown as React.Ref<HTMLDivElement>}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-current={selected ? "true" : undefined}
      className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 border-l-4 px-3.5 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 ${
        selected ? "border-l-teal-600 bg-teal-50/70" : "border-l-transparent hover:bg-slate-50"
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-slate-900">
          {highlightSegments(item.name, search).map((seg, i) =>
            seg.match ? (
              <mark key={i} className="rounded-sm bg-amber-200 text-slate-900">
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </span>
        <span className="truncate text-slate-600">{item.stageLabel}</span>
      </div>
      <span className={`shrink-0 whitespace-nowrap tabular-nums ${overdue ? "font-semibold text-rose-700" : "text-slate-600"}`}>
        {waitLabel(item.waitingSince, now)}
      </span>
    </div>
  );
}
