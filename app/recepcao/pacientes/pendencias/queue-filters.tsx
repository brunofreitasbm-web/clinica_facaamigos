"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { normalizeSearch } from "./queue-filters-pure";

/**
 * Em que ponto do funil o contato está. Só pré-cadastros (drafts) têm etapa;
 * o resto da fila (guia vencendo, falta etc.) fica com `null` e só responde
 * aos filtros de atraso/dono/busca.
 */
export type QueueStage = "docs" | "autorizacao" | "agendar" | "liberado";

export type FilterableQueueItem = {
  id: string;
  category: string;
  categoryLabel: string;
  /** Nome, telefone, detalhe — tudo em minúsculas sem acento, pra busca. */
  haystack: string;
  stage: QueueStage | null;
  overdue: boolean;
  escalated: boolean;
  dueAt: string | null;
  mine: boolean;
  node: ReactNode;
};

/** Escalado > atrasado > prazo mais próximo > sem prazo. */
export function urgencyRank(a: FilterableQueueItem, b: FilterableQueueItem): number {
  if (a.escalated !== b.escalated) return a.escalated ? -1 : 1;
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt || b.dueAt) return a.dueAt ? -1 : 1;
  return 0;
}

type Quick = "atrasados" | "meus" | QueueStage;

const QUICK_FILTERS: { key: Quick; label: string }[] = [
  { key: "atrasados", label: "Atrasados" },
  { key: "meus", label: "Meus itens" },
  { key: "docs", label: "Faltam documentos" },
  { key: "autorizacao", label: "Aguardando plano" },
  { key: "agendar", label: "Prontos p/ agendar" },
];

function matches(item: FilterableQueueItem, quick: Quick | null, category: string | null, term: string): boolean {
  if (category && item.category !== category) return false;
  if (quick === "atrasados" && !item.overdue) return false;
  if (quick === "meus" && !item.mine) return false;
  if (quick && quick !== "atrasados" && quick !== "meus" && item.stage !== quick) return false;
  if (term) {
    const digits = term.replace(/\D/g, "");
    const byText = item.haystack.includes(term);
    const byPhone = digits.length >= 4 && item.haystack.replace(/\D/g, "").includes(digits);
    if (!byText && !byPhone) return false;
  }
  return true;
}

export function QueueFilters({
  items,
  categoryOrder,
}: {
  items: FilterableQueueItem[];
  categoryOrder: string[];
}) {
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<Quick | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [byUrgency, setByUrgency] = useState(false);

  const term = normalizeSearch(search);

  const counts = useMemo(() => {
    const c: Record<Quick, number> = { atrasados: 0, meus: 0, docs: 0, autorizacao: 0, agendar: 0, liberado: 0 };
    for (const item of items) {
      if (item.overdue) c.atrasados++;
      if (item.mine) c.meus++;
      if (item.stage) c[item.stage]++;
    }
    return c;
  }, [items]);

  const categories = useMemo(() => {
    const seen = new Map<string, { label: string; count: number }>();
    for (const item of items) {
      const cur = seen.get(item.category);
      if (cur) cur.count++;
      else seen.set(item.category, { label: item.categoryLabel, count: 1 });
    }
    return categoryOrder.filter((c) => seen.has(c)).map((c) => ({ key: c, ...seen.get(c)! }));
  }, [items, categoryOrder]);

  const visible = items.filter((item) => matches(item, quick, category, term));
  const byCategory = new Map<string, FilterableQueueItem[]>();
  for (const item of visible) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const isFiltering = Boolean(quick || category || term);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex min-w-[240px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou detalhe…"
              className="w-full rounded-md border border-paper-line-strong bg-paper py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              aria-label="Buscar na fila de pendências"
            />
          </label>
          <select
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value || null)}
            className="rounded-md border border-paper-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink"
            aria-label="Filtrar por tipo de pendência"
          >
            <option value="">Todos os tipos ({items.length})</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={byUrgency}
              onChange={(e) => setByUrgency(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-accent)]"
            />
            Uma fila só, por urgência
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_FILTERS.map((f) => {
            const active = quick === f.key;
            const count = counts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setQuick(active ? null : f.key)}
                disabled={count === 0 && !active}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-paper-line-strong bg-paper text-ink-soft hover:bg-paper-subtle"
                }`}
              >
                {f.label} <span className="tabular-figure opacity-80">{count}</span>
              </button>
            );
          })}
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQuick(null);
                setCategory(null);
              }}
              className="ml-1 inline-flex items-center gap-1 text-[12px] text-ink-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" /> Limpar ({visible.length} de {items.length})
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-ink-faint">Nenhuma pendência com esses filtros.</p>
      )}

      {byUrgency && visible.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Por urgência ({visible.length})
          </h2>
          <div className="flex flex-col gap-1.5">
            {[...visible].sort(urgencyRank).map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5">
                <span className="pl-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  {item.categoryLabel}
                </span>
                {item.node}
              </div>
            ))}
          </div>
        </section>
      )}

      {!byUrgency && categoryOrder.map((cat) => {
        const list = byCategory.get(cat);
        if (!list || list.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {list[0].categoryLabel} ({list.length})
            </h2>
            <div className="flex flex-col gap-1.5">{list.map((item) => item.node)}</div>
          </section>
        );
      })}
    </>
  );
}
