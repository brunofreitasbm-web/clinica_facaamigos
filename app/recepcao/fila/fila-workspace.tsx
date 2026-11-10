"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FILA_GROUPS,
  countByGroup,
  filterFila,
  sortFila,
  waitLabel,
  type FilaGroup,
  type FilaItem,
} from "@/lib/fila/fila-model-pure";
import { FilaDetailPanel } from "./fila-detail";
import { UndoToast, useUndoToast } from "./undo-toast";
import { UNDO_SECONDS } from "./undo-toast-pure";

/**
 * Tela mestre-detalhe da Fila de entrada: abas por situação, busca, "Só os meus", lista com o próximo passo de
 * cada família e o detalhe da selecionada. Cada família está em UM grupo (lib/fila/fila-model-pure.ts).
 */
export function FilaWorkspace({
  items,
  owners,
  userId,
  initialSelectedId,
}: {
  items: FilaItem[];
  owners: { id: string; full_name: string }[];
  userId: string | null;
  initialSelectedId: string | null;
}) {
  const [tab, setTab] = useState<FilaGroup>(() => items.find((i) => i.id === initialSelectedId)?.group ?? "agir");
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  // Referência de tempo fixa por montagem: render puro, sem Date.now() solto.
  const [nowMs] = useState(() => Date.now());
  const router = useRouter();
  // Um aviso com Desfazer para a tela toda: vale para o caso em que a ação foi feita, mesmo que ele mude de aba.
  const undoToast = useUndoToast(UNDO_SECONDS, () => router.refresh());

  const filter = useMemo(() => ({ mine, userId, query }), [mine, userId, query]);
  const counts = useMemo(() => countByGroup(items, filter), [items, filter]);
  const list = useMemo(() => sortFila(filterFila(items, { ...filter, tab })), [items, filter, tab]);

  const group = FILA_GROUPS.find((g) => g.key === tab) ?? FILA_GROUPS[0];
  // Sem seleção explícita, abre a primeira da aba; a seleção sobrevive a uma ação que muda a família de grupo.
  const selected = items.find((i) => i.id === selectedId) ?? list[0] ?? null;
  const movedTo = selected && selected.group !== tab ? FILA_GROUPS.find((g) => g.key === selected.group) : null;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nenhuma família na fila"
        description="Todos os contatos do WhatsApp foram processados ou já estão com a Supervisão."
        action={{ label: "Ir para a Agenda do dia", href: "/recepcao" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Grupos da fila" className="flex flex-wrap gap-2">
          {FILA_GROUPS.map((g) => {
            const on = g.key === tab;
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setTab(g.key);
                  setSelectedId(null);
                }}
                className={`flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] px-3 text-[15px] font-extrabold sm:gap-2.5 sm:px-[18px] sm:text-base ${
                  on
                    ? "border-[var(--color-dark)] bg-[var(--color-dark)] text-white"
                    : "border-paper-line-strong bg-white text-ink hover:bg-paper"
                }`}
              >
                {g.label}
                <span
                  className={`min-w-[26px] rounded-full px-2 text-center text-sm font-extrabold ${
                    on ? "bg-white text-[var(--color-dark)]" : "bg-paper-line text-ink"
                  }`}
                >
                  {counts[g.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="fila-busca" className="sr-only">
            Buscar por criança, responsável ou telefone
          </label>
          <input
            id="fila-busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar criança ou responsável"
            className="input w-[300px] max-w-full"
          />
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setMine((v) => !v)}
            className={`min-h-11 rounded-xl border-[1.5px] px-4 text-[15px] font-extrabold ${
              mine
                ? "border-[var(--color-dark)] bg-[var(--color-dark)] text-white"
                : "border-paper-line-strong bg-white text-ink hover:bg-paper"
            }`}
          >
            Só os meus
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Lista da fila"
          className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-2xl border border-paper-line-strong bg-white"
        >
          <div className="border-b border-paper-line px-[18px] py-3.5 text-sm font-bold text-ink-soft">{group.hint}</div>
          {list.length === 0 ? (
            <p className="m-0 px-[18px] py-7 text-base text-ink-soft">
              {query.trim() || mine ? "Nenhuma família com esse filtro neste grupo." : "Ninguém neste grupo agora."}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {list.map((item) => {
                const on = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelectedId(item.id)}
                      className={`block w-full border-0 border-b border-paper-line px-[18px] py-4 text-left ${
                        on ? "bg-[var(--color-accent-100)] shadow-[inset_0_0_0_2px_var(--color-accent)]" : "bg-white hover:bg-paper"
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[17px] font-extrabold text-ink">{item.child}</span>
                        <span
                          className={`flex-none text-sm font-extrabold ${item.overdue ? "text-status-negative-text" : "text-ink-soft"}`}
                        >
                          {waitLabel(item.createdAt, nowMs, item.overdue)}
                        </span>
                      </span>
                      <span className="mt-1 block text-[15px] text-ink">{item.step.listText}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {item.guardian ? `Responsável: ${item.guardian}` : "Responsável não informado"}
                        {item.assignedToName ? ` · com ${item.assignedToName}` : " · sem dono"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-label="Detalhe"
          className="min-w-0 flex-[999_1_560px] rounded-2xl border border-paper-line-strong bg-white p-7"
        >
          {selected ? (
            <>
              {movedTo && (
                <p role="status" className="m-0 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-paper px-4 py-3 text-base text-ink">
                  Esta família saiu desta aba e agora está em “{movedTo.label}”.
                  <button
                    type="button"
                    className="font-bold text-[var(--color-accent)] underline"
                    onClick={() => {
                      setTab(movedTo.key);
                      setSelectedId(selected.id);
                    }}
                  >
                    Ir para {movedTo.label}
                  </button>
                </p>
              )}
              <FilaDetailPanel key={selected.id} item={selected} owners={owners} nowMs={nowMs} onUndoable={undoToast.show} />
            </>
          ) : (
            <p className="m-0 text-base text-ink-soft">Escolha uma família na lista para ver o próximo passo.</p>
          )}
        </section>
      </div>
      <UndoToast toast={undoToast.toast} onUndo={undoToast.undo} onDismiss={undoToast.dismiss} />
    </div>
  );
}
