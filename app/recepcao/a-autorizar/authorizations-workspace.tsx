"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileClock,
  Filter,
  Inbox,
  Layers,
  ListFilter,
  MessageSquare,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { extractDraftOnDemand } from "../pacientes/pendencias/draft-pipeline-actions";
import { highlightSegments, matchesSearch } from "../pacientes/pendencias/queue-filters-pure";
import { MoveToLastButton } from "../pacientes/pendencias/move-to-last-button";
import type { WorkspaceItem } from "../pacientes/pendencias/queue-workspace";
import type { PendingQueueItem } from "@/lib/reception-queue";

export type AuthFilterStatus =
  | "todos"
  | "nao_atendido"
  | "atendido"
  | "falta_docs"
  | "abertas"
  | "aguardando"
  | "pendencias"
  | "concluidas";

export type AuthFilterPendency =
  | "todas"
  | "docs_geral"
  | "laudo"
  | "pedido_medico"
  | "carteirinha"
  | "rg_ou_certidao"
  | "devolvido"
  | "atrasado";

export type AuthFilterForwarding =
  | "todos"
  | "sem_dono"
  | "no_plano"
  | "p_agendar"
  | "meus"
  | string;

export type EnrichedAuthItem = WorkspaceItem & {
  raw: PendingQueueItem;
  treatmentStatus: "nao_atendido" | "atendido";
  isUntreated: boolean;
  hasOutboundMessage: boolean;
  isLastMessageInbound: boolean;
  lastMessageSnippet: string | null;
  hasMissingDocs: boolean;
  missingPillKeys: string[];
  isReturned: boolean;
  returnedReason: string | null;
  authStatus: "pendente" | "enviada" | "autorizada" | "dispensada";
  isWaitingPlan: boolean;
  isCompleted: boolean;
  isOpen: boolean;
  forwardingKey: "sem_dono" | "no_plano" | "p_agendar" | "atribuido";
};

type BoardCategory = "nao_tratados" | "falta_docs" | "no_plano" | "concluidas";

const BOARD_CONFIG: Record<
  BoardCategory,
  {
    title: string;
    description: string;
    icon: typeof ShieldAlert;
    borderClass: string;
    bgHeaderClass: string;
    badgeClass: string;
    textClass: string;
  }
> = {
  nao_tratados: {
    title: "Não Tratados & Atenção Imediata",
    description: "Sem atendimento humano inicial, aguardando resposta ou devolvidos pela supervisão",
    icon: ShieldAlert,
    borderClass: "border-rose-300 hover:border-rose-400",
    bgHeaderClass: "bg-rose-50/90 border-b border-rose-200",
    badgeClass: "bg-rose-600 text-white",
    textClass: "text-rose-900",
  },
  falta_docs: {
    title: "Falta Enviar Documentos",
    description: "Aguardando envio ou conferência de laudos, pedidos médicos ou dados da família",
    icon: FileClock,
    borderClass: "border-amber-300 hover:border-amber-400",
    bgHeaderClass: "bg-amber-50/90 border-b border-amber-200",
    badgeClass: "bg-amber-600 text-white",
    textClass: "text-amber-900",
  },
  no_plano: {
    title: "Aguardando Retorno do Convênio",
    description: "Guia médica enviada ao plano de saúde; em análise da operadora",
    icon: Clock,
    borderClass: "border-sky-300 hover:border-sky-400",
    bgHeaderClass: "bg-sky-50/90 border-b border-sky-200",
    badgeClass: "bg-sky-600 text-white",
    textClass: "text-sky-900",
  },
  concluidas: {
    title: "Concluídas & Prontos para Agendar",
    description: "Autorização liberada ou dispensada pelo convênio; prontos para 1ª avaliação",
    icon: CheckCircle2,
    borderClass: "border-emerald-300 hover:border-emerald-400",
    bgHeaderClass: "bg-emerald-50/90 border-b border-emerald-200",
    badgeClass: "bg-emerald-600 text-white",
    textClass: "text-emerald-900",
  },
};

const READ_DELAY_MS = 700;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function AuthorizationsWorkspace({
  items,
  queue,
  owners,
  initial,
}: {
  items: WorkspaceItem[];
  queue: PendingQueueItem[];
  owners: { id: string; name: string }[];
  initial: {
    q?: string;
    status?: AuthFilterStatus;
    pendencia?: AuthFilterPendency;
    encaminhamento?: AuthFilterForwarding;
    item?: string | null;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();

  // Estados de Filtros
  const [search, setSearch] = useState(initial.q ?? "");
  const [statusFilter, setStatusFilter] = useState<AuthFilterStatus>(initial.status ?? "todos");
  const [pendencyFilter, setPendencyFilter] = useState<AuthFilterPendency>(initial.pendencia ?? "todas");
  const [forwardingFilter, setForwardingFilter] = useState<AuthFilterForwarding>(initial.encaminhamento ?? "todos");
  const [viewMode, setViewMode] = useState<"quadros" | "lista">("quadros");

  // Estado de Seleção e UI
  const [selectedId, setSelectedId] = useState<string | null>(initial.item ?? null);
  const [openBoards, setOpenBoards] = useState<Record<BoardCategory, boolean>>({
    nao_tratados: true,
    falta_docs: true,
    no_plano: true,
    concluidas: true,
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [reading, startReading] = useTransition();
  const readRequested = useRef(new Set<string>());

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const detailRef = useRef<HTMLDivElement>(null);

  // Mapeia raw item para enriched
  const rawMap = useMemo(() => new Map(queue.map((q) => [q.id, q])), [queue]);

  const enrichedItems = useMemo<EnrichedAuthItem[]>(() => {
    return items.map((item) => {
      const raw = rawMap.get(item.id) ?? ({} as PendingQueueItem);
      const draft = raw.draft;
      const messages = draft?.messages ?? [];
      const hasOutbound = messages.some((m) => m.direction === "outbound");
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const isLastInbound = lastMsg ? lastMsg.direction === "inbound" : false;

      // Não atendido: nunca respondeu OU última mensagem foi inbound da família esperando retorno OU sem dono
      const isUntreated =
        !hasOutbound || isLastInbound || (!item.ownerId && draft?.pipeline.authorization === "pendente");
      const treatmentStatus: "nao_atendido" | "atendido" = isUntreated ? "nao_atendido" : "atendido";

      const missingCount = draft?.pendencies.missingCount ?? item.missingCount ?? 0;
      const hasMissingDocs = missingCount > 0;
      const missingPillKeys = draft?.pendencies.pills.filter((p) => p.state === "faltando").map((p) => p.key) ?? [];

      const isReturned = Boolean(draft?.pipeline.returned);
      const returnedReason = draft?.pipeline.returned?.reason ?? null;

      const authStatus = draft?.pipeline.authorization ?? "pendente";
      const isWaitingPlan = authStatus === "enviada";
      const isCompleted =
        authStatus === "autorizada" ||
        authStatus === "dispensada" ||
        item.stage === "agendar" ||
        item.stage === "liberado";
      const isOpen = !isCompleted;

      let forwardingKey: "sem_dono" | "no_plano" | "p_agendar" | "atribuido" = "atribuido";
      if (!item.ownerId) forwardingKey = "sem_dono";
      else if (isWaitingPlan) forwardingKey = "no_plano";
      else if (isCompleted) forwardingKey = "p_agendar";

      return {
        ...item,
        raw,
        treatmentStatus,
        isUntreated,
        hasOutboundMessage: hasOutbound,
        isLastMessageInbound: isLastInbound,
        lastMessageSnippet: lastMsg?.body ? lastMsg.body.slice(0, 70) : null,
        hasMissingDocs,
        missingPillKeys,
        isReturned,
        returnedReason,
        authStatus,
        isWaitingPlan,
        isCompleted,
        isOpen,
        forwardingKey,
      };
    });
  }, [items, rawMap]);

  // Itens ativos sem demitidos
  const activeItems = useMemo(
    () => enrichedItems.filter((i) => !dismissedIds.has(i.id) && !(i.readDraftId && dismissedIds.has(i.readDraftId))),
    [enrichedItems, dismissedIds],
  );

  // Escuta demissões
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

  // Indicadores de Quantidade por Categoria / Status (Leis de Miller e Gestalt)
  const counts = useMemo(() => {
    const total = activeItems.length;
    const naoAtendidos = activeItems.filter((i) => i.isUntreated).length;
    const atendidos = activeItems.filter((i) => !i.isUntreated).length;
    const faltaDocs = activeItems.filter((i) => i.hasMissingDocs).length;
    const abertas = activeItems.filter((i) => i.isOpen).length;
    const aguardando = activeItems.filter((i) => i.isWaitingPlan || (i.hasMissingDocs && !i.isUntreated)).length;
    const pendencias = activeItems.filter((i) => i.hasMissingDocs || i.isReturned || i.overdue || i.escalated).length;
    const concluidas = activeItems.filter((i) => i.isCompleted).length;

    // Contagens por pendências específicas
    const pendenciasDocs = activeItems.filter((i) => i.hasMissingDocs).length;
    const pendenciasLaudo = activeItems.filter((i) => i.missingPillKeys.includes("laudo")).length;
    const pendenciasPedido = activeItems.filter((i) => i.missingPillKeys.includes("pedido_medico")).length;
    const pendenciasCarteira = activeItems.filter((i) => i.missingPillKeys.includes("carteirinha")).length;
    const pendenciasRg = activeItems.filter(
      (i) => i.missingPillKeys.includes("rg_cria") || i.missingPillKeys.includes("certidao_nasc"),
    ).length;
    const pendenciasDevolvido = activeItems.filter((i) => i.isReturned).length;
    const pendenciasAtrasado = activeItems.filter((i) => i.overdue || i.escalated).length;

    // Contagens por encaminhamento
    const semDono = activeItems.filter((i) => !i.ownerId).length;
    const noPlano = activeItems.filter((i) => i.isWaitingPlan).length;
    const prontoAgendar = activeItems.filter((i) => i.isCompleted).length;
    const meus = activeItems.filter((i) => i.mine).length;

    return {
      total,
      naoAtendidos,
      atendidos,
      faltaDocs,
      abertas,
      aguardando,
      pendencias,
      concluidas,
      pendenciasDocs,
      pendenciasLaudo,
      pendenciasPedido,
      pendenciasCarteira,
      pendenciasRg,
      pendenciasDevolvido,
      pendenciasAtrasado,
      semDono,
      noPlano,
      prontoAgendar,
      meus,
    };
  }, [activeItems]);

  // Filtragem dos itens
  const visibleItems = useMemo(() => {
    return activeItems.filter((item) => {
      // 1. Busca textual
      if (search.trim() && !matchesSearch(item.haystack, search)) return false;

      // 2. Filtro principal de Status
      if (statusFilter === "nao_atendido" && !item.isUntreated) return false;
      if (statusFilter === "atendido" && item.isUntreated) return false;
      if (statusFilter === "falta_docs" && !item.hasMissingDocs) return false;
      if (statusFilter === "abertas" && !item.isOpen) return false;
      if (statusFilter === "aguardando" && !(item.isWaitingPlan || (item.hasMissingDocs && !item.isUntreated)))
        return false;
      if (statusFilter === "pendencias" && !(item.hasMissingDocs || item.isReturned || item.overdue || item.escalated))
        return false;
      if (statusFilter === "concluidas" && !item.isCompleted) return false;

      // 3. Filtro de Pendências Específicas
      if (pendencyFilter === "docs_geral" && !item.hasMissingDocs) return false;
      if (pendencyFilter === "laudo" && !item.missingPillKeys.includes("laudo")) return false;
      if (pendencyFilter === "pedido_medico" && !item.missingPillKeys.includes("pedido_medico")) return false;
      if (pendencyFilter === "carteirinha" && !item.missingPillKeys.includes("carteirinha")) return false;
      if (
        pendencyFilter === "rg_ou_certidao" &&
        !item.missingPillKeys.includes("rg_cria") &&
        !item.missingPillKeys.includes("certidao_nasc")
      )
        return false;
      if (pendencyFilter === "devolvido" && !item.isReturned) return false;
      if (pendencyFilter === "atrasado" && !item.overdue && !item.escalated) return false;

      // 4. Filtro de Encaminhamento
      if (forwardingFilter === "sem_dono" && item.ownerId) return false;
      if (forwardingFilter === "no_plano" && !item.isWaitingPlan) return false;
      if (forwardingFilter === "p_agendar" && !item.isCompleted) return false;
      if (forwardingFilter === "meus" && !item.mine) return false;
      if (
        forwardingFilter !== "todos" &&
        forwardingFilter !== "sem_dono" &&
        forwardingFilter !== "no_plano" &&
        forwardingFilter !== "p_agendar" &&
        forwardingFilter !== "meus"
      ) {
        if (item.ownerId !== forwardingFilter) return false;
      }

      return true;
    });
  }, [activeItems, search, statusFilter, pendencyFilter, forwardingFilter]);

  // Agrupamento nos 4 Quadros Retráteis
  const boardItems = useMemo(() => {
    const naoTratados: EnrichedAuthItem[] = [];
    const faltaDocs: EnrichedAuthItem[] = [];
    const noPlano: EnrichedAuthItem[] = [];
    const concluidas: EnrichedAuthItem[] = [];

    for (const item of visibleItems) {
      if (item.isCompleted) {
        concluidas.push(item);
      } else if (item.isWaitingPlan) {
        noPlano.push(item);
      } else if (item.isUntreated || item.isReturned || item.band === "agora") {
        naoTratados.push(item);
      } else {
        faltaDocs.push(item);
      }
    }

    return {
      nao_tratados: naoTratados,
      falta_docs: faltaDocs,
      no_plano: noPlano,
      concluidas: concluidas,
    };
  }, [visibleItems]);

  // Lista navegável unificada para teclado
  const navigable = useMemo(() => {
    if (viewMode === "lista") return visibleItems;
    return [
      ...(openBoards.nao_tratados ? boardItems.nao_tratados : []),
      ...(openBoards.falta_docs ? boardItems.falta_docs : []),
      ...(openBoards.no_plano ? boardItems.no_plano : []),
      ...(openBoards.concluidas ? boardItems.concluidas : []),
    ];
  }, [viewMode, visibleItems, openBoards, boardItems]);

  const shownId = selectedId ?? navigable[0]?.id ?? null;
  const selected = shownId ? activeItems.find((i) => i.id === shownId) ?? null : null;

  // Próximo lead para navegação contínua
  const nextItem = useMemo(() => {
    if (!selectedId) return null;
    const currentIndex = visibleItems.findIndex((i) => i.id === selectedId);
    if (currentIndex >= 0 && currentIndex < visibleItems.length - 1) {
      return visibleItems[currentIndex + 1];
    }
    return visibleItems.find((i) => i.id !== selectedId && !i.isCompleted) ?? null;
  }, [visibleItems, selectedId]);

  // Sincronização de URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, val: string | null) => (val ? params.set(key, val) : params.delete(key));
    set("q", search.trim() || null);
    set("status", statusFilter === "todos" ? null : statusFilter);
    set("pendencia", pendencyFilter === "todas" ? null : pendencyFilter);
    set("encaminhamento", forwardingFilter === "todos" ? null : forwardingFilter);
    set("item", selectedId);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [search, statusFilter, pendencyFilter, forwardingFilter, selectedId]);

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
    if (navigable.length === 0) return;
    const index = selectedId ? navigable.findIndex((i) => i.id === selectedId) : -1;
    const nextIndex =
      index === -1 ? (delta > 0 ? 0 : navigable.length - 1) : Math.min(navigable.length - 1, Math.max(0, index + delta));
    select(navigable[nextIndex].id, true);
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

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("todos");
    setPendencyFilter("todas");
    setForwardingFilter("todos");
    searchRef.current?.focus();
  };

  const isFiltering =
    Boolean(search.trim()) || statusFilter !== "todos" || pendencyFilter !== "todas" || forwardingFilter !== "todos";

  const toggleAllBoards = (expand: boolean) => {
    setOpenBoards({
      nao_tratados: expand,
      falta_docs: expand,
      no_plano: expand,
      concluidas: expand,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. BARRA SUPERIOR: BUSCA E CONTROLES GERAIS (Lei de Hick & Fitts) */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xs backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campo de Busca Rápida */}
          <label className="relative flex min-w-[260px] flex-[1_1_340px] items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por criança, responsável, telefone, convênio ou 'falta laudo'..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              aria-label="Buscar autorizações"
            />
            {!search && (
              <kbd className="pointer-events-none absolute right-3 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 shadow-2xs">
                /
              </kbd>
            )}
          </label>

          {/* Filtro Dropdown por Pendências */}
          <div className="flex items-center gap-1.5">
            <ListFilter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={pendencyFilter}
              onChange={(e) => setPendencyFilter(e.target.value as AuthFilterPendency)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              aria-label="Filtrar por tipo de pendência"
            >
              <option value="todas">Todas as pendências</option>
              <option value="docs_geral">Faltam documentos ({counts.pendenciasDocs})</option>
              <option value="laudo">Falta Laudo ({counts.pendenciasLaudo})</option>
              <option value="pedido_medico">Falta Pedido Médico ({counts.pendenciasPedido})</option>
              <option value="carteirinha">Falta Carteirinha ({counts.pendenciasCarteira})</option>
              <option value="rg_ou_certidao">Falta RG/Certidão ({counts.pendenciasRg})</option>
              <option value="devolvido">Devolvido p/ supervisão ({counts.pendenciasDevolvido})</option>
              <option value="atrasado">Atrasado / Urgente ({counts.pendenciasAtrasado})</option>
            </select>
          </div>

          {/* Filtro Dropdown por Encaminhamento */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={forwardingFilter}
              onChange={(e) => setForwardingFilter(e.target.value as AuthFilterForwarding)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              aria-label="Filtrar por encaminhamento ou operador"
            >
              <option value="todos">Todos os encaminhamentos</option>
              <option value="sem_dono">Sem operador atribuído ({counts.semDono})</option>
              <option value="no_plano">No Plano de Saúde ({counts.noPlano})</option>
              <option value="p_agendar">Pronto p/ Agendar ({counts.prontoAgendar})</option>
              <option value="meus">Atribuídos a mim ({counts.meus})</option>
              {owners.length > 0 && <option disabled>── Por Operador ──</option>}
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Alternador de Modo de Visualização */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("quadros")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "quadros"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Visualizar em quadros retráteis coloridos"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Quadros</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("lista")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "lista"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Visualizar em lista unificada"
              >
                <Inbox className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>

            {isFiltering && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* 2. CHIPS DE STATUS RÁPIDOS (Lei de Miller: chunking de 7 categorias essenciais com contadores) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <StatusChip
            label="Todos"
            count={counts.total}
            active={statusFilter === "todos"}
            onClick={() => setStatusFilter("todos")}
            tone="default"
          />
          <StatusChip
            label="Ainda não atendido"
            count={counts.naoAtendidos}
            active={statusFilter === "nao_atendido"}
            onClick={() => setStatusFilter(statusFilter === "nao_atendido" ? "todos" : "nao_atendido")}
            tone="rose"
            icon={<UserX className="h-3.5 w-3.5" />}
          />
          <StatusChip
            label="Já atendido"
            count={counts.atendidos}
            active={statusFilter === "atendido"}
            onClick={() => setStatusFilter(statusFilter === "atendido" ? "todos" : "atendido")}
            tone="slate"
            icon={<UserCheck className="h-3.5 w-3.5" />}
          />
          <StatusChip
            label="Falta enviar docs"
            count={counts.faltaDocs}
            active={statusFilter === "falta_docs"}
            onClick={() => setStatusFilter(statusFilter === "falta_docs" ? "todos" : "falta_docs")}
            tone="amber"
            icon={<FileClock className="h-3.5 w-3.5" />}
          />
          <StatusChip
            label="Abertas"
            count={counts.abertas}
            active={statusFilter === "abertas"}
            onClick={() => setStatusFilter(statusFilter === "abertas" ? "todos" : "abertas")}
            tone="teal"
          />
          <StatusChip
            label="Aguardando retorno"
            count={counts.aguardando}
            active={statusFilter === "aguardando"}
            onClick={() => setStatusFilter(statusFilter === "aguardando" ? "todos" : "aguardando")}
            tone="sky"
            icon={<Clock className="h-3.5 w-3.5" />}
          />
          <StatusChip
            label="Pendências"
            count={counts.pendencias}
            active={statusFilter === "pendencias"}
            onClick={() => setStatusFilter(statusFilter === "pendencias" ? "todos" : "pendencias")}
            tone="orange"
            icon={<AlertCircle className="h-3.5 w-3.5" />}
          />
          <StatusChip
            label="Concluídas"
            count={counts.concluidas}
            active={statusFilter === "concluidas"}
            onClick={() => setStatusFilter(statusFilter === "concluidas" ? "todos" : "concluidas")}
            tone="emerald"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />

          {viewMode === "quadros" && (
            <div className="ml-auto hidden xl:flex items-center gap-2 text-[11px] text-slate-500">
              <button
                type="button"
                onClick={() => toggleAllBoards(true)}
                className="hover:text-slate-800 underline"
              >
                Expandir quadros
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => toggleAllBoards(false)}
                className="hover:text-slate-800 underline"
              >
                Recolher quadros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. ÁREA PRINCIPAL SPLIT: LISTA/QUADROS À ESQUERDA + DETALHE À DIREITA */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[410px_minmax(0,1fr)]">
        {/* Painel Esquerdo: Quadros Retráteis ou Lista */}
        <div onKeyDown={onListKeyDown} className="flex min-w-0 flex-col gap-3.5">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-2xs">
              <Inbox className="h-8 w-8 text-slate-400 mb-2" />
              <p className="m-0 text-sm font-semibold text-slate-700">Nenhum lead encontrado com estes filtros</p>
              <p className="m-0 mt-1 text-xs text-slate-500">Tente ajustar a busca ou limpar os filtros aplicados.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700"
              >
                <X className="h-3.5 w-3.5" /> Limpar todos os filtros
              </button>
            </div>
          ) : viewMode === "quadros" ? (
            // Modo Quadros Retráteis Coloridos
            (Object.keys(BOARD_CONFIG) as BoardCategory[]).map((category) => {
              const list = boardItems[category];
              if (list.length === 0 && isFiltering) return null;
              const config = BOARD_CONFIG[category];
              const Icon = config.icon;
              const isOpen = isFiltering || openBoards[category];

              return (
                <section
                  key={category}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-2xs transition-all ${config.borderClass}`}
                  aria-labelledby={`board-${category}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenBoards((prev) => ({ ...prev, [category]: !prev[category] }))}
                    className={`flex w-full items-center justify-between px-3.5 py-3 text-left transition-colors ${config.bgHeaderClass}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-2xs">
                        <Icon className={`h-4 w-4 ${config.textClass}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`m-0 truncate text-xs font-bold uppercase tracking-wider ${config.textClass}`}>
                            {config.title}
                          </h3>
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${config.badgeClass}`}
                          >
                            {list.length}
                          </span>
                        </div>
                        <p className="m-0 truncate text-[11px] text-slate-500">{config.description}</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                      {list.length === 0 ? (
                        <li className="px-4 py-5 text-center text-xs text-slate-400">
                          Nenhum lead nesta categoria no momento.
                        </li>
                      ) : (
                        list.map((item) => (
                          <li key={item.id}>
                            <AuthorizationsRow
                              item={item}
                              search={search}
                              selected={item.id === shownId}
                              onSelect={() => select(item.id)}
                              buttonRef={(el) => {
                                if (el) rowRefs.current.set(item.id, el);
                                else rowRefs.current.delete(item.id);
                              }}
                            />
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </section>
              );
            })
          ) : (
            // Modo Lista Unificada
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Leads de Autorização ({visibleItems.length})
                </span>
                <span className="text-xs text-slate-400">Ordem de prioridade</span>
              </div>
              <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                {visibleItems.map((item) => (
                  <li key={item.id}>
                    <AuthorizationsRow
                      item={item}
                      search={search}
                      selected={item.id === shownId}
                      onSelect={() => select(item.id)}
                      buttonRef={(el) => {
                        if (el) rowRefs.current.set(item.id, el);
                        else rowRefs.current.delete(item.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Dicas de Atalho */}
          <div className="hidden md:flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border bg-white px-1 font-mono text-[10px]">↑</kbd>
              <kbd className="rounded border bg-white px-1 font-mono text-[10px]">↓</kbd> navegar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border bg-white px-1 font-mono text-[10px]">/</kbd> buscar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border bg-white px-1 font-mono text-[10px]">Esc</kbd> foco
            </span>
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
                            ⭐ Missão Cumprida
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
              <p className="m-0 mt-1 max-w-sm text-xs text-slate-500">
                Os dados completos do WhatsApp, documentos, mensagens da família e a linha do tempo aparecerão aqui.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 4. LINHA INDIVIDUAL DO LEAD (AuthorizationsRow)
function AuthorizationsRow({
  item,
  search,
  selected,
  onSelect,
  buttonRef,
}: {
  item: EnrichedAuthItem;
  search: string;
  selected: boolean;
  onSelect: () => void;
  buttonRef: (el: HTMLElement | null) => void;
}) {
  const late = item.escalated || item.overdue;

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
      className={`group flex w-full cursor-pointer flex-col gap-1.5 px-3.5 py-3 text-left transition-all ${
        selected
          ? "border-l-4 border-l-teal-600 bg-teal-50/70 shadow-2xs"
          : "border-l-4 border-l-transparent hover:bg-slate-50/80"
      }`}
    >
      {/* Linha 1: Nome do Paciente + Badges de Status */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-slate-900 group-hover:text-teal-700">
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
        <div className="flex items-center gap-1 shrink-0">
          <MoveToLastButton itemId={item.id} patientName={item.name} isPostponed={item.isPostponed} compact />
          <span
            className={`whitespace-nowrap text-xs tabular-figure ${
              item.isPostponed
                ? "text-amber-700 font-semibold"
                : late
                  ? "font-bold text-rose-600"
                  : "text-slate-500"
            }`}
          >
            {item.dueText}
          </span>
        </div>
      </div>

      {/* Linha 2: Badges Visuais Informativos (Tags de Status e Pendência) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {item.isUntreated ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
            <UserX className="h-3 w-3" /> Não Atendido
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            <UserCheck className="h-3 w-3 text-slate-500" /> Atendido
          </span>
        )}

        {item.isLastMessageInbound && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            <MessageSquare className="h-3 w-3 text-emerald-600" /> Mensagem pendente
          </span>
        )}

        {item.isReturned && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
            <AlertTriangle className="h-3 w-3" /> Devolvido
          </span>
        )}

        {item.isWaitingPlan && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
            <Clock className="h-3 w-3" /> No Plano
          </span>
        )}

        {item.isCompleted && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Pronto p/ Agendar
          </span>
        )}

        {item.hasMissingDocs && !item.isCompleted && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <FileClock className="h-3 w-3" /> Faltam {item.missingCount} docs
          </span>
        )}
      </div>

      {/* Linha 3: Snippet da Mensagem ou Operador */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 pt-0.5">
        <span className="truncate max-w-[240px]">
          {item.lastMessageSnippet ? `"${item.lastMessageSnippet}..."` : item.categoryLabel}
        </span>
        {item.ownerName ? (
          <span className="shrink-0 text-[11px] font-medium text-slate-600">
            {item.ownerName.split(" ")[0]}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-bold text-rose-600">Sem dono</span>
        )}
      </div>
    </div>
  );
}

// 5. CHIP DE STATUS (Filtros rápidos em pílula com cores semânticas e contador)
function StatusChip({
  label,
  count,
  active,
  onClick,
  tone = "default",
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "default" | "rose" | "amber" | "sky" | "emerald" | "slate" | "teal" | "orange";
  icon?: ReactNode;
}) {
  const toneClasses: Record<string, { active: string; inactive: string }> = {
    default: {
      active: "bg-slate-900 text-white border-slate-900 shadow-2xs",
      inactive: "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
    },
    rose: {
      active: "bg-rose-600 text-white border-rose-600 shadow-2xs",
      inactive: "bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100/70",
    },
    amber: {
      active: "bg-amber-600 text-white border-amber-600 shadow-2xs",
      inactive: "bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100/70",
    },
    sky: {
      active: "bg-sky-600 text-white border-sky-600 shadow-2xs",
      inactive: "bg-sky-50/70 text-sky-800 border-sky-200 hover:bg-sky-100/70",
    },
    emerald: {
      active: "bg-emerald-600 text-white border-emerald-600 shadow-2xs",
      inactive: "bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70",
    },
    slate: {
      active: "bg-slate-700 text-white border-slate-700 shadow-2xs",
      inactive: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
    },
    teal: {
      active: "bg-teal-700 text-white border-teal-700 shadow-2xs",
      inactive: "bg-teal-50/70 text-teal-800 border-teal-200 hover:bg-teal-100/70",
    },
    orange: {
      active: "bg-orange-600 text-white border-orange-600 shadow-2xs",
      inactive: "bg-orange-50/70 text-orange-800 border-orange-200 hover:bg-orange-100/70",
    },
  };

  const style = toneClasses[tone] ?? toneClasses.default;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
        active ? style.active : style.inactive
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-figure ${
          active ? "bg-white/20 text-white" : "bg-black/5 text-inherit"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
