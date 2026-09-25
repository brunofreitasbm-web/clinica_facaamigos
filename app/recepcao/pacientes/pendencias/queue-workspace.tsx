"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Clock, Search, X } from "lucide-react";
import { extractDraftOnDemand } from "./draft-pipeline-actions";
import { BAND_ORDER, highlightSegments, matchesSearch, type UrgencyBand } from "./queue-filters-pure";

/**
 * Em que ponto do funil o contato está. Só pré-cadastros (drafts) têm etapa;
 * o resto da fila (guia vencendo, falta etc.) fica com `null` e só responde
 * aos filtros de tipo/dono/busca.
 */
export type QueueStage = "docs" | "autorizacao" | "agendar" | "liberado";

export type WorkspaceItem = {
  id: string;
  category: string;
  categoryLabel: string;
  name: string;
  band: UrgencyBand;
  overdue: boolean;
  escalated: boolean;
  dueAt: string | null;
  /** Prazo curto já formatado no servidor ("hoje 18:00", "atrasado · ontem 14:00"). */
  dueText: string;
  ownerId: string | null;
  ownerName: string | null;
  stage: QueueStage | null;
  /** Só pré-cadastro: quantos documentos/dados ainda faltam. */
  missingCount: number | null;
  mine: boolean;
  /** Nome, telefone, detalhe, dados lidos, "falta <doc>" — sem acento, minúsculas. */
  haystack: string;
  /** Pré-cadastro com arquivos ainda não lidos: a IA lê ao abrir o contato. */
  readDraftId: string | null;
  /** Painel de detalhe, montado no servidor. */
  detail: ReactNode;
};

export type WorkspaceFilters = {
  q: string;
  tipo: string | null;
  etapa: QueueStage | null;
  dono: string | null;
  meus: boolean;
  item: string | null;
};

/** Escalado > atrasado > prazo mais próximo > sem prazo. */
export function urgencyRank(
  a: Pick<WorkspaceItem, "escalated" | "overdue" | "dueAt">,
  b: Pick<WorkspaceItem, "escalated" | "overdue" | "dueAt">,
): number {
  if (a.escalated !== b.escalated) return a.escalated ? -1 : 1;
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt || b.dueAt) return a.dueAt ? -1 : 1;
  return 0;
}

const STAGE_LABEL: Record<QueueStage, string> = {
  docs: "Faltam documentos",
  autorizacao: "Aguardando plano",
  agendar: "Pronto p/ agendar",
  liberado: "Liberado",
};

const BAND_TITLE: Record<UrgencyBand, string> = {
  agora: "Agora",
  hoje: "Hoje",
  depois: "Depois",
};

const NO_OWNER = "sem-dono";

/** Tempo que a seleção precisa ficar parada num contato para a IA ler os arquivos (setas passam rápido). */
const READ_DELAY_MS = 700;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function QueueWorkspace({
  items,
  categoryOrder,
  owners,
  initial,
}: {
  items: WorkspaceItem[];
  categoryOrder: string[];
  owners: { id: string; name: string }[];
  initial: WorkspaceFilters;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.q);
  const [tipo, setTipo] = useState<string | null>(initial.tipo);
  const [etapa, setEtapa] = useState<QueueStage | null>(initial.etapa);
  const [dono, setDono] = useState<string | null>(initial.dono);
  const [meus, setMeus] = useState(initial.meus);
  const [selectedId, setSelectedId] = useState<string | null>(initial.item);
  const [openBands, setOpenBands] = useState<Record<UrgencyBand, boolean>>({ agora: true, hoje: true, depois: false });

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const detailRef = useRef<HTMLDivElement>(null);
  const readRequested = useRef(new Set<string>());
  const [reading, startReading] = useTransition();

  const isFiltering = Boolean(search.trim() || tipo || etapa || dono || meus);

  const categories = useMemo(() => {
    const seen = new Map<string, { label: string; count: number }>();
    for (const item of items) {
      const cur = seen.get(item.category);
      if (cur) cur.count++;
      else seen.set(item.category, { label: item.categoryLabel, count: 1 });
    }
    return categoryOrder.filter((c) => seen.has(c)).map((c) => ({ key: c, ...seen.get(c)! }));
  }, [items, categoryOrder]);

  const stageCounts = useMemo(() => {
    const c: Record<QueueStage, number> = { docs: 0, autorizacao: 0, agendar: 0, liberado: 0 };
    for (const item of items) if (item.stage) c[item.stage]++;
    return c;
  }, [items]);

  const mineCount = useMemo(() => items.filter((i) => i.mine).length, [items]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (tipo && item.category !== tipo) return false;
        if (etapa && item.stage !== etapa) return false;
        if (meus && !item.mine) return false;
        if (dono === NO_OWNER && item.ownerId) return false;
        if (dono && dono !== NO_OWNER && item.ownerId !== dono) return false;
        return matchesSearch(item.haystack, search);
      }),
    [items, tipo, etapa, meus, dono, search],
  );

  const bands = useMemo(
    () =>
      BAND_ORDER.map((band) => ({
        band,
        list: visible.filter((i) => i.band === band).sort(urgencyRank),
      })),
    [visible],
  );

  // Com busca/filtro, todas as faixas abrem: o resultado não pode ficar escondido numa faixa recolhida.
  const bandIsOpen = (band: UrgencyBand) => isFiltering || openBands[band];

  const navigable = bands.flatMap(({ band, list }) => (bandIsOpen(band) ? list : []));
  const selected = selectedId ? items.find((i) => i.id === selectedId) ?? null : null;

  // Estado na URL (sem recarregar a página nem refazer a consulta): F5, voltar e
  // link compartilhado mantêm a busca e o contato aberto.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
    set("q", search.trim() || null);
    set("tipo", tipo);
    set("etapa", etapa);
    set("dono", dono);
    set("meus", meus ? "1" : null);
    set("item", selectedId);
    params.delete("lead");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [search, tipo, etapa, dono, meus, selectedId]);

  // A IA lê os arquivos do pré-cadastro só quando alguém de fato para no contato,
  // uma vez por contato, e nunca ao carregar a fila.
  useEffect(() => {
    const draftId = selected?.readDraftId;
    if (!draftId || readRequested.current.has(draftId)) return;
    const timer = window.setTimeout(() => {
      readRequested.current.add(draftId);
      startReading(async () => {
        try {
          await extractDraftOnDemand(draftId);
          router.refresh();
        } catch {
          // A leitura é só um acelerador: falha aqui não impede o trabalho manual.
        }
      });
    }, READ_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selected?.readDraftId, router]);

  // Seleção vinda de ?item= / ?lead=: rola até a linha.
  useEffect(() => {
    if (initial.item) rowRefs.current.get(initial.item)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback((id: string | null, focus = false) => {
    setSelectedId(id);
    if (id === null) return;
    detailRef.current?.scrollTo({ top: 0 });
    const row = rowRefs.current.get(id);
    if (focus) row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }, []);

  // "/" ou Ctrl/Cmd+K de qualquer lugar da tela vai para a busca.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSlash = e.key === "/" && !isEditable(e.target);
      const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (!isSlash && !isCmdK) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const move = (delta: number) => {
    if (navigable.length === 0) return;
    const index = selectedId ? navigable.findIndex((i) => i.id === selectedId) : -1;
    const nextIndex = index === -1 ? (delta > 0 ? 0 : navigable.length - 1) : Math.min(navigable.length - 1, Math.max(0, index + delta));
    select(navigable[nextIndex].id, true);
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (navigable[0]) select(navigable[0].id, true);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = navigable[navigable.length - 1];
      if (last) select(last.id, true);
    } else if (e.key === "Escape") {
      setSelectedId(null);
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (navigable[0]) select(navigable[0].id, true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (search) setSearch("");
      else if (selectedId) rowRefs.current.get(selectedId)?.focus();
      else searchRef.current?.blur();
    }
  };

  const clearFilters = () => {
    setSearch("");
    setTipo(null);
    setEtapa(null);
    setDono(null);
    setMeus(false);
    searchRef.current?.focus();
  };

  const selectClass =
    "h-11 min-w-0 max-w-[230px] rounded-md border border-paper-line-strong bg-paper-surface px-3 text-[15px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de busca e filtros — fica presa no topo enquanto a lista rola. */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 xl:flex-nowrap border-b border-paper-line bg-paper px-1 py-3">
        <label className="relative flex min-w-[240px] flex-[1_1_420px] items-center">
          <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-ink-soft" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Buscar nome, telefone, responsável, plano ou “falta laudo”"
            className="h-11 w-full rounded-md border border-paper-line-strong bg-paper-surface pl-11 pr-12 text-base text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Buscar na fila de pendências"
            aria-keyshortcuts="/ Control+K"
            autoComplete="off"
          />
          {!search && (
            <kbd className="pointer-events-none absolute right-3 rounded border border-paper-line-strong bg-paper px-1.5 text-[13px] font-semibold text-ink-soft">
              /
            </kbd>
          )}
        </label>
        <button
          type="button"
          aria-pressed={meus}
          onClick={() => setMeus((v) => !v)}
          disabled={mineCount === 0 && !meus}
          className={`h-11 rounded-full border px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            meus
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
              : "border-paper-line-strong bg-paper-surface text-ink hover:bg-[var(--color-accent-100)]"
          }`}
        >
          Meus <span className="tabular-figure">{mineCount}</span>
        </button>
        <select value={tipo ?? ""} onChange={(e) => setTipo(e.target.value || null)} className={selectClass} aria-label="Tipo de pendência">
          <option value="">Todos os tipos</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
        <select
          value={etapa ?? ""}
          onChange={(e) => setEtapa((e.target.value || null) as QueueStage | null)}
          className={selectClass}
          aria-label="Etapa do pré-cadastro"
        >
          <option value="">Todas as etapas</option>
          {(Object.keys(STAGE_LABEL) as QueueStage[]).map((s) => (
            <option key={s} value={s} disabled={stageCounts[s] === 0}>
              {STAGE_LABEL[s]} ({stageCounts[s]})
            </option>
          ))}
        </select>
        {owners.length > 0 && (
          <select value={dono ?? ""} onChange={(e) => setDono(e.target.value || null)} className={selectClass} aria-label="Dono da pendência">
            <option value="">Qualquer dono</option>
            <option value={NO_OWNER}>Sem dono</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <p className="m-0 ml-auto flex shrink-0 items-center gap-3 text-[15px] text-ink-soft" aria-live="polite">
          <span>
            <strong className="tabular-figure text-ink">{visible.length}</strong> de{" "}
            <span className="tabular-figure">{items.length}</span>
          </span>
          {isFiltering && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-100)]"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Limpar
            </button>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(460px,560px)_minmax(0,1fr)]">
        {/* Lista */}
        <div onKeyDown={onListKeyDown} className="flex min-w-0 flex-col gap-4">
          {visible.length === 0 && (
            <div className="rounded-lg bg-paper-surface px-5 py-8 text-center shadow-sm">
              <p className="m-0 text-base text-ink">Nada encontrado com esses filtros.</p>
              <button type="button" onClick={clearFilters} className="btn btn-ghost mt-2">
                Limpar busca e filtros
              </button>
            </div>
          )}
          {bands.map(({ band, list }) => {
            if (list.length === 0) return null;
            const open = bandIsOpen(band);
            return (
              <section key={band} aria-labelledby={`band-${band}`} className="overflow-hidden rounded-lg bg-paper-surface shadow-sm">
                <h2 id={`band-${band}`} className="m-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    disabled={isFiltering}
                    onClick={() => setOpenBands((s) => ({ ...s, [band]: !s[band] }))}
                    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-extrabold uppercase tracking-[0.08em] disabled:cursor-default ${
                      band === "agora" ? "text-status-negative-text" : "text-ink"
                    }`}
                  >
                    {band === "agora" && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                    {BAND_TITLE[band]}
                    <span className="tabular-figure rounded-full bg-paper px-2 py-0.5 text-sm tracking-normal">{list.length}</span>
                    {!isFiltering && (
                      <ChevronDown
                        className={`ml-auto h-5 w-5 text-ink-soft transition-transform ${open ? "" : "-rotate-90"}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </h2>
                {open && (
                  <ul className="m-0 list-none divide-y divide-paper-line border-t border-paper-line p-0">
                    {list.map((item) => (
                      <li key={item.id}>
                        <QueueRow
                          item={item}
                          search={search}
                          selected={item.id === selectedId}
                          onSelect={() => select(item.id)}
                          buttonRef={(el) => {
                            if (el) rowRefs.current.set(item.id, el);
                            else rowRefs.current.delete(item.id);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Detalhe: coluna fixa no desktop; no celular/tablet, tela cheia por cima da lista. */}
        <div
          ref={detailRef}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isEditable(e.target) && selectedId) {
              const id = selectedId;
              setSelectedId(null);
              rowRefs.current.get(id)?.focus();
            }
          }}
          className={
            selected
              ? "fixed inset-0 z-50 overflow-y-auto bg-paper p-4 xl:z-auto xl:sticky xl:top-[84px] xl:max-h-[calc(100dvh-100px)] xl:rounded-lg xl:bg-paper-surface xl:p-6 xl:shadow-sm"
              : "hidden xl:sticky xl:top-[84px] xl:block"
          }
          role={selected ? "region" : undefined}
          aria-label={selected ? `Pendência de ${selected.name}` : undefined}
        >
          {selected ? (
            <>
              <div className="mb-3 flex justify-end xl:hidden">
                <button type="button" onClick={() => setSelectedId(null)} className="btn btn-secondary">
                  <X className="h-4 w-4" aria-hidden="true" /> Voltar para a lista
                </button>
              </div>
              {reading && (
                <p className="m-0 mb-4 rounded-md bg-[var(--color-accent-100)] px-4 py-2.5 text-[15px] text-ink">
                  Lendo os documentos com IA…
                </p>
              )}
              {selected.detail}
            </>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-paper-line-strong px-8 text-center">
              <p className="m-0 text-lg font-bold text-ink">Escolha uma pendência na lista</p>
              <p className="m-0 max-w-sm text-[15px] text-ink-soft">Arquivos, dados, conversa e ações aparecem aqui, sem perder o lugar na fila.</p>
              <ul className="m-0 flex list-none flex-wrap justify-center gap-x-5 gap-y-2 p-0 text-[15px] text-ink-soft">
                <li>
                  <Kbd>/</Kbd> buscar
                </li>
                <li>
                  <Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar
                </li>
                <li>
                  <Kbd>Esc</Kbd> limpar
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-paper-line-strong bg-paper-surface px-1.5 py-0.5 text-sm font-semibold text-ink">{children}</kbd>
  );
}

function QueueRow({
  item,
  search,
  selected,
  onSelect,
  buttonRef,
}: {
  item: WorkspaceItem;
  search: string;
  selected: boolean;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const late = item.escalated || item.overdue;
  const Icon = item.band === "agora" ? AlertTriangle : item.band === "hoje" ? Clock : null;
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:relative focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)] ${
        selected ? "bg-[var(--color-accent-100)]" : "hover:bg-paper"
      }`}
    >
      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
        {Icon && (
          <Icon className={`h-4 w-4 ${item.band === "agora" ? "text-status-negative-text" : "text-status-pending-text"}`} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`truncate text-base font-bold ${selected ? "text-[var(--color-accent)]" : "text-ink"}`}>
            {highlightSegments(item.name, search).map((seg, i) =>
              seg.match ? (
                <mark key={i} className="rounded-sm bg-[var(--color-accent-2-200)] text-inherit">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap text-sm tabular-figure ${
              late ? "font-bold text-status-negative-text" : "text-ink-soft"
            }`}
          >
            {item.dueText}
          </span>
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate text-ink-soft">
            {item.categoryLabel}
            {item.missingCount !== null &&
              (item.missingCount > 0 ? (
                <span className="font-bold text-status-negative-text"> · Faltam {item.missingCount}</span>
              ) : (
                <span className="font-semibold text-status-positive-text"> · Completo</span>
              ))}
          </span>
          <span className="shrink-0 whitespace-nowrap text-ink-faint">{item.ownerName ? item.ownerName.split(" ")[0] : "Sem dono"}</span>
        </span>
      </span>
    </button>
  );
}
