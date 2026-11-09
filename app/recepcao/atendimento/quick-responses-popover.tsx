"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type QuickResponseRow = { id: string; shortcut: string; title: string; contentText: string };

export type QuickResponsesStatus = "loading" | "ready" | "error";

// As respostas rápidas mudam raramente e o campo de mensagem é recriado a cada troca de conversa:
// um cache curto evita uma ida ao banco por conversa aberta.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; rows: QuickResponseRow[] } | null = null;

function freshCache(): QuickResponseRow[] | null {
  return cache && Date.now() - cache.at < CACHE_TTL_MS ? cache.rows : null;
}

/** Carrega as respostas rápidas uma vez (com cache de 60 s) e permite tentar de novo se falhar. */
export function useQuickResponses(): {
  responses: QuickResponseRow[];
  status: QuickResponsesStatus;
  reload: () => void;
} {
  const [responses, setResponses] = useState<QuickResponseRow[]>(() => freshCache() ?? []);
  const [status, setStatus] = useState<QuickResponsesStatus>(() => (freshCache() ? "ready" : "loading"));
  const [reloadKey, setReloadKey] = useState(0);
  const firstRender = useRef(true);

  useEffect(() => {
    // Primeira carga com cache válido não vai ao banco; "tentar de novo" sempre vai.
    if (firstRender.current) {
      firstRender.current = false;
      if (freshCache()) return;
    }
    let cancelled = false;
    createClient()
      .from("quick_responses")
      .select("id, shortcut, title, content_text")
      .order("shortcut")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatus("error");
          return;
        }
        const rows = (data ?? []).map((r) => ({
          id: r.id,
          shortcut: r.shortcut,
          title: r.title,
          contentText: r.content_text,
        }));
        cache = { at: Date.now(), rows };
        setResponses(rows);
        setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  return { responses, status, reload };
}

export const QUICK_RESPONSES_LISTBOX_ID = "quick-responses-listbox";

export function quickResponseOptionId(id: string): string {
  return `quick-response-${id}`;
}

/**
 * Lista de respostas rápidas. Apresentacional: quem decide o item destacado e o que o teclado faz
 * é o campo de mensagem (lib/atendimento/quick-responses-pure.ts), para que Enter/Tab escolham o
 * item em vez de enviar "/atalho" ao paciente.
 */
export function QuickResponsesPopover({
  items,
  activeIndex,
  status,
  onSelect,
  onHover,
  onRetry,
}: {
  items: QuickResponseRow[];
  activeIndex: number;
  status: QuickResponsesStatus;
  onSelect: (item: QuickResponseRow) => void;
  onHover: (index: number) => void;
  onRetry: () => void;
}) {
  const activeId = items[activeIndex]?.id;

  // Mantém o item destacado à vista quando a navegação por seta passa da área visível.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(quickResponseOptionId(activeId))?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <div className="absolute bottom-full left-0 z-10 mb-2 w-80 max-h-64 overflow-y-auto rounded-md border border-paper-line-strong bg-white shadow-lg">
      {status === "loading" && <p className="p-3 text-xs text-ink-faint">Carregando…</p>}
      {status === "error" && (
        <div role="alert" className="flex items-center justify-between gap-2 p-3 text-xs text-red-700">
          <span>Não foi possível carregar as respostas rápidas.</span>
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}
      {status === "ready" && items.length === 0 && (
        <p className="p-3 text-xs text-ink-faint">Nenhuma resposta rápida encontrada.</p>
      )}
      {items.length > 0 && (
        <div role="listbox" id={QUICK_RESPONSES_LISTBOX_ID} aria-label="Respostas rápidas">
          {items.map((r, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={r.id}
                id={quickResponseOptionId(r.id)}
                type="button"
                role="option"
                aria-selected={isActive}
                tabIndex={-1}
                // onMouseDown: o clique não tira o foco do campo de mensagem.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(r)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-paper-line px-3 py-2 text-left ${
                  isActive ? "bg-teal-50 dark:bg-slate-800" : "hover:bg-paper"
                }`}
              >
                <span className="text-xs font-semibold text-chart">{r.shortcut}</span>
                <span className="text-xs text-ink-soft">{r.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
