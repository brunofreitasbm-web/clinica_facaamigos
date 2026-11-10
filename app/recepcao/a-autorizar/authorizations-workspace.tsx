"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Inbox, Search, Sparkles, X } from "lucide-react";
import { extractDraftOnDemand } from "../pacientes/pendencias/draft-pipeline-actions";
import { HelpHint } from "@/components/ui/help-hint";
import type { WorkspaceItem } from "../pacientes/pendencias/queue-workspace";
import type { PendingQueueItem } from "@/lib/reception-queue";
import { INTAKE_GROUP_ORDER, intakeStageLabel, type IntakeGroup } from "../../../lib/intake-queue-pure.ts";
import { filterIntakeItems, groupItems } from "./intake-filters-pure.ts";
import { IntakeTabs } from "./intake-tabs.tsx";
import { IntakeList, type IntakeListItem } from "./intake-list.tsx";

export type EnrichedAuthItem = WorkspaceItem &
  IntakeListItem & {
    isCompleted: boolean;
  };

const READ_DELAY_MS = 700;

/** Rótulo "2 de 4 · Enviar guia" a partir da etapa que o servidor já calculou em `draft.intake`. */
function stageLabelOf(draft: NonNullable<PendingQueueItem["draft"]>): string {
  const stage = draft.intake.stage;
  const stamp = "1970-01-01T00:00:00Z";
  return intakeStageLabel({
    authorization: draft.pipeline.authorization,
    // Só o resultado de `intakeStage` importa aqui: estes campos o forçam para a etapa certa.
    schedulingEnabledAt: stage === 4 ? stamp : null,
    planDeniedAt: stage === 2 && draft.pipeline.authorization !== "pendente" ? stamp : null,
    planAskedMoreDocsAt: stage === 1 ? stamp : null,
    missingDocs: 0,
    familyChasedAt: null,
  });
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Fila de entrada: busca + "Só os meus", 4 abas por grupo (Agir agora, Aguardando família,
 * Aguardando plano, Concluídos) e, ao lado, o painel de detalhe do caso selecionado.
 */
export function AuthorizationsWorkspace({
  items,
  queue,
  nowIso,
  hiddenCount,
  initial,
}: {
  items: WorkspaceItem[];
  queue: PendingQueueItem[];
  /** Instante do servidor, para a hidratação mostrar o mesmo "há N dias". */
  nowIso: string;
  /** Leads com chat encerrado, tirados da fila (link discreto no fim da lista). */
  hiddenCount: number;
  initial: {
    q?: string;
    tab?: IntakeGroup | null;
    mine?: boolean;
    item?: string | null;
  };
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const [search, setSearch] = useState(initial.q ?? "");
  const [onlyMine, setOnlyMine] = useState(Boolean(initial.mine));
  const [selectedId, setSelectedId] = useState<string | null>(initial.item ?? null);

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [reading, startReading] = useTransition();
  const readRequested = useRef(new Set<string>());

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const detailRef = useRef<HTMLDivElement>(null);

  const rawMap = useMemo(() => new Map(queue.map((q) => [q.id, q])), [queue]);

  const enrichedItems = useMemo<EnrichedAuthItem[]>(() => {
    return items.map((item) => {
      const raw = rawMap.get(item.id);
      const draft = raw?.draft;
      const authStatus = draft?.pipeline.authorization ?? "pendente";
      const isCompleted =
        authStatus === "autorizada" ||
        authStatus === "dispensada" ||
        item.stage === "agendar" ||
        item.stage === "liberado";
      return {
        ...item,
        isCompleted,
        // Todo caso da fila de autorizações tem rascunho; o fallback só evita quebrar a tela.
        group: draft?.intake.group ?? "agir_agora",
        waitingSince: draft?.intake.waitingSince ?? nowIso,
        stageLabel: draft ? stageLabelOf(draft) : "",
      };
    });
  }, [items, rawMap, nowIso]);

  const activeItems = useMemo(
    () => enrichedItems.filter((i) => !dismissedIds.has(i.id) && !(i.readDraftId && dismissedIds.has(i.readDraftId))),
    [enrichedItems, dismissedIds],
  );

  useEffect(() => {
    const handleDismiss = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          next.add(`cadastro-ia-${id}`);
          return next;
        });
      }
    };
    window.addEventListener("queue-item-dismiss", handleDismiss);
    return () => window.removeEventListener("queue-item-dismiss", handleDismiss);
  }, []);

  // Contagens das abas: refletem o total da fila ANTES da busca por texto e de "Só os meus",
  // para a soma das abas sempre fechar com o total e o número não "piscar" enquanto se digita.
  const grouped = useMemo(() => groupItems(activeItems), [activeItems]);
  const counts = useMemo(() => {
    const out = {} as Record<IntakeGroup, number>;
    for (const g of INTAKE_GROUP_ORDER) out[g] = grouped[g].length;
    return out;
  }, [grouped]);

  // Aba inicial: a do caso pedido por ?item=, senão a do parâmetro legado, senão "Agir agora".
  const [tab, setTab] = useState<IntakeGroup>(() => {
    const requested = initial.item ? items.find((i) => i.id === initial.item) : null;
    const requestedGroup = requested ? enrichedItems.find((i) => i.id === requested.id)?.group : null;
    return requestedGroup ?? initial.tab ?? "agir_agora";
  });

  const tabItems = useMemo(
    () => filterIntakeItems(grouped[tab], { search, onlyMine }),
    [grouped, tab, search, onlyMine],
  );

  const shownId = selectedId ?? tabItems[0]?.id ?? null;
  const selected = shownId ? activeItems.find((i) => i.id === shownId) ?? null : null;

  const nextItem = useMemo(() => {
    if (!selectedId) return null;
    const currentIndex = tabItems.findIndex((i) => i.id === selectedId);
    if (currentIndex >= 0 && currentIndex < tabItems.length - 1) return tabItems[currentIndex + 1];
    return tabItems.find((i) => i.id !== selectedId && !i.isCompleted) ?? null;
  }, [tabItems, selectedId]);

  // Sincronização de URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, val: string | null) => (val ? params.set(key, val) : params.delete(key));
    // Parâmetros legados saem da URL: a aba os substitui.
    for (const legacy of ["status", "etapa", "pendencia", "encaminhamento", "dono"]) params.delete(legacy);
    set("q", search.trim() || null);
    set("aba", tab === "agir_agora" ? null : tab);
    set("meus", onlyMine ? "1" : null);
    set("item", selectedId);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [search, tab, onlyMine, selectedId]);

  // Extração automática IA ao parar no item
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
          // leitura em segundo plano
        }
      });
    }, READ_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selected?.readDraftId, router]);

  const select = useCallback((id: string | null, focus = false) => {
    setSelectedId(id);
    if (!id) return;
    detailRef.current?.scrollTo({ top: 0 });
    const row = rowRefs.current.get(id);
    if (focus) row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }, []);

  const changeTab = (group: IntakeGroup) => {
    setTab(group);
    setSelectedId(null);
  };

  const registerRow = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  // Atalhos de teclado globais (/ e Ctrl+K)
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
    if (tabItems.length === 0) return;
    const index = selectedId ? tabItems.findIndex((i) => i.id === selectedId) : -1;
    const nextIndex =
      index === -1 ? (delta > 0 ? 0 : tabItems.length - 1) : Math.min(tabItems.length - 1, Math.max(0, index + delta));
    select(tabItems[nextIndex].id, true);
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Escape") {
      searchRef.current?.focus();
    }
  };

  const isFiltering = Boolean(search.trim()) || onlyMine;
  const clearFilters = () => {
    setSearch("");
    setOnlyMine(false);
    searchRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho de uma linha: busca e "Só os meus" (o título fica no PageHeader da página) */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-[240px] max-w-xl flex-[1_1_340px] items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            aria-label="Buscar na fila de entrada"
          />
        </label>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-teal-600"
          />
          Só os meus
        </label>
        {isFiltering && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Limpar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[410px_minmax(0,1fr)]">
        {/* Painel esquerdo: abas e lista */}
        <div onKeyDown={onListKeyDown} className="flex min-w-0 flex-col gap-2">
          <IntakeTabs counts={counts} active={tab} onChange={changeTab} />
          <section
            id="intake-tabpanel"
            role="tabpanel"
            aria-labelledby={`intake-tab-${tab}`}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
          >
            <IntakeList
              items={tabItems}
              selectedId={shownId}
              onSelect={(id) => select(id)}
              search={search}
              now={now}
              registerRow={registerRow}
              empty={
                isFiltering ? (
                  <>
                    <Inbox className="mx-auto mb-2 h-6 w-6 text-slate-500" aria-hidden="true" />
                    Nenhum caso com esta busca nesta aba.
                  </>
                ) : (
                  "Nenhum caso nesta aba."
                )
              }
              footer={
                hiddenCount > 0 ? (
                  <p className="m-0 flex items-center justify-end gap-1 border-t border-slate-100 px-3.5 py-2 text-sm text-slate-600">
                    <span className="underline decoration-dotted underline-offset-2">
                      {hiddenCount} {hiddenCount === 1 ? "lead oculto" : "leads ocultos"}
                    </span>
                    <HelpHint text="Conversa já encerrada no chat e sem guia em andamento. Voltam se a família escrever de novo." />
                  </p>
                ) : null
              }
            />
          </section>
          <div className="hidden justify-end md:flex">
            <HelpHint
              label="Atalhos de teclado"
              text={
                <>
                  Atalhos: <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> navegar,{" "}
                  <kbd className="font-mono">/</kbd> buscar, <kbd className="font-mono">Esc</kbd> voltar o foco à lista.
                </>
              }
            />
          </div>
        </div>

        {/* Painel Direito: Detalhes do Lead Selecionado (Split View) */}
        <div
          ref={detailRef}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isEditable(e.target) && shownId) {
              rowRefs.current.get(shownId)?.focus();
            }
          }}
          className={
            selected
              ? `${
                  selectedId ? "fixed inset-0 z-50 overflow-y-auto bg-white p-4" : "hidden"
                } md:block md:z-auto md:sticky md:top-[128px] md:max-h-[calc(100dvh-146px)] md:overflow-y-auto md:rounded-2xl md:border md:border-slate-200 md:bg-white md:p-6 md:shadow-xs`
              : "hidden md:sticky md:top-[128px] md:block"
          }
          role={selected ? "region" : undefined}
          aria-label={selected ? `Detalhes de ${selected.name}` : undefined}
        >
          {selected ? (
            <>
              {/* Botão Voltar no Mobile */}
              <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex justify-start border-b border-slate-200 bg-white px-4 py-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" /> Voltar para a lista
                </button>
              </div>

              {/* Banner de Celebração de Conclusão / Pronto para Agendar */}
              {selected.isCompleted && (
                <div className="mb-4 overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 shadow-2xs">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-200/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                            Habilitado para agendamento
                          </span>
                          <span className="text-xs font-semibold text-emerald-800">
                            Pronto para agendar
                          </span>
                        </div>
                        <h3 className="m-0 mt-1 text-sm font-bold text-slate-900">
                          Autorização concluída com sucesso!
                        </h3>
                        <p className="m-0 mt-0.5 text-xs text-slate-600">
                          A 1ª Avaliação já está liberada na Agenda da Supervisão.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href="/supervisao?tab=agenda1a"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>Abrir Agenda de Avaliações</span>
                      </a>
                      {nextItem && nextItem.id !== selected.id && (
                        <button
                          type="button"
                          onClick={() => select(nextItem.id, true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                        >
                          <span>Próximo lead</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Banner de Leitura da IA */}
              {(reading || selected.readDraftId) && (
                <div
                  className="mb-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-semibold text-teal-900 shadow-2xs"
                  aria-live="polite"
                >
                  <Sparkles className="h-4 w-4 text-teal-600 animate-pulse" />
                  <span>{reading ? "A IA está processando os documentos..." : "Documentos na fila de leitura da IA"}</span>
                </div>
              )}

              {/* Conteúdo Rico do Lead (DraftIntakeCard) */}
              {selected.detail}
            </>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Inbox className="h-10 w-10 text-slate-400 mb-3" />
              <h3 className="m-0 text-base font-bold text-slate-800">Selecione uma autorização</h3>
              <p className="m-0 mt-1 max-w-sm text-xs text-slate-500">Os dados do lead aparecerão aqui.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
