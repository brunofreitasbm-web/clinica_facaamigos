"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { UNDO_SECONDS, canUndo, toastReducer, type ToastState } from "./undo-toast-pure.ts";

/**
 * Aviso com "Desfazer" da Fila de entrada (regras em undo-toast-pure.ts).
 *
 * O hook mora na área de trabalho, não no detalhe: depois de uma ação o caso pode mudar de aba e o
 * detalhe trocar de caso, e o aviso continua valendo para o caso em que a ação foi feita. O desfazer
 * guarda o próprio draftId e o estado anterior; nunca usa o caso que está aberto na tela. Recarregar
 * a página ou desmontar a tela descarta o aviso, e um resultado que chega depois disso é ignorado.
 */

type UndoResult = { success: true } | { success: false; error: string };

export type UndoEntry = {
  draftId: string;
  /** Texto do aviso, ex.: "Guia de Ana marcada como enviada." */
  message: string;
  undo: () => Promise<UndoResult>;
};

const TICK_MS = 250;

export function useUndoToast(seconds: number = UNDO_SECONDS, onUndone?: (draftId: string) => void) {
  const [state, dispatch] = useReducer(toastReducer, null as ToastState);
  const nextId = useRef(1);
  const entries = useRef(new Map<number, UndoEntry>());
  const mounted = useRef(true);
  const onUndoneRef = useRef(onUndone);
  const stateRef = useRef<ToastState>(null);
  // Um desfazer por vez: o segundo clique (antes do estado "Desfazendo…" chegar à tela) é ignorado.
  const inFlight = useRef(false);

  useEffect(() => {
    onUndoneRef.current = onUndone;
    stateRef.current = state;
  });

  useEffect(() => {
    mounted.current = true;
    const map = entries.current;
    return () => {
      mounted.current = false;
      map.clear();
    };
  }, []);

  // Relógio só enquanto há aviso na tela.
  useEffect(() => {
    if (!state) return;
    const timer = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_MS);
    return () => window.clearInterval(timer);
  }, [state]);

  // Aviso que saiu da tela não guarda mais a função de desfazer.
  useEffect(() => {
    for (const id of entries.current.keys()) if (id !== state?.id) entries.current.delete(id);
  }, [state?.id]);

  const show = useCallback(
    (entry: UndoEntry) => {
      const id = nextId.current++;
      entries.current.set(id, entry);
      dispatch({ type: "show", id, draftId: entry.draftId, message: entry.message, now: Date.now(), seconds });
    },
    [seconds],
  );

  const undo = useCallback(async () => {
    const current = stateRef.current;
    if (!current || inFlight.current) return;
    const entry = entries.current.get(current.id);
    const now = Date.now();
    // O desfazer só vale para o caso em que a ação foi feita, dentro do prazo.
    if (!entry || entry.draftId !== current.draftId || !canUndo(current, current.id, entry.draftId, now)) return;
    inFlight.current = true;
    // Usado uma vez só: sai do mapa antes de rodar.
    entries.current.delete(current.id);
    dispatch({ type: "undo_start", id: current.id, draftId: entry.draftId, now });
    let result: UndoResult;
    try {
      result = await entry.undo();
    } catch {
      result = { success: false, error: "Não foi possível desfazer. Tente de novo." };
    } finally {
      inFlight.current = false;
    }
    if (!mounted.current) return;
    dispatch({
      type: "undo_result",
      id: current.id,
      ok: result.success,
      message: result.success ? "Ação desfeita." : `Não foi possível desfazer: ${result.error}`,
      now: Date.now(),
      seconds,
    });
    if (result.success) onUndoneRef.current?.(entry.draftId);
  }, [seconds]);

  const dismiss = useCallback(() => {
    const current = stateRef.current;
    if (current) dispatch({ type: "dismiss", id: current.id });
  }, []);

  return { toast: state, show, undo, dismiss };
}

export function UndoToast({ toast, onUndo, onDismiss }: { toast: ToastState; onUndo: () => void; onDismiss: () => void }) {
  if (!toast) return null;
  const tone = toast.phase === "error" ? "border-rose-300 bg-rose-50 text-rose-900" : "border-slate-700 bg-slate-900 text-white";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
      <div
        role={toast.phase === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border px-4 py-2 text-sm shadow-lg ${tone}`}
      >
        <span className="min-w-0 flex-1">{toast.message}</span>
        {(toast.phase === "open" || toast.phase === "undoing") && (
          <button
            type="button"
            onClick={onUndo}
            disabled={toast.phase === "undoing"}
            className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60"
          >
            {toast.phase === "undoing" ? "Desfazendo…" : "Desfazer"}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-base opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          ×
        </button>
      </div>
    </div>
  );
}
