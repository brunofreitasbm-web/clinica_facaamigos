"use client";

import type { ReactNode } from "react";
import { isOverdue } from "./intake-filters-pure.ts";
import { IntakeRow, type IntakeRowItem } from "./intake-row.tsx";
import type { IntakeGroup } from "../../../lib/intake-queue-pure.ts";

export type IntakeListItem = IntakeRowItem & { group: IntakeGroup };

/** Lista de uma aba, já ordenada por quem espera há mais tempo. */
export function IntakeList({
  items,
  selectedId,
  onSelect,
  search = "",
  now,
  registerRow,
  empty,
  footer,
}: {
  items: IntakeListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search?: string;
  now: Date;
  registerRow?: (id: string, el: HTMLElement | null) => void;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-600">{empty ?? "Nenhum caso nesta aba."}</div>
      ) : (
        <ul className="m-0 list-none divide-y divide-slate-100 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <IntakeRow
                item={item}
                search={search}
                now={now}
                // Concluído não espera mais ninguém: sem alerta de atraso.
                overdue={item.group !== "concluidos" && isOverdue(item.waitingSince, now)}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
                buttonRef={registerRow ? (el) => registerRow(item.id, el) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
      {footer}
    </div>
  );
}
