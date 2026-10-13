"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { reportUxError } from "@/components/friction-tracker";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  text: string;
  type: ToastType;
  undoAction?: () => void;
}

interface ToastContextType {
  toast: (text: string, type?: ToastType, undoAction?: () => void, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(
    (text: string, type: ToastType = "success", undoAction?: () => void, durationMs = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      if (type === "error") reportUxError("toast", text);
      setToasts((prev) => [...prev, { id, text, type, undoAction }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Container de Toasts flutuantes (Peak-End Rule & Fitts's Law) */}
      <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 z-50 flex flex-col gap-2.5 sm:max-w-md pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all duration-150 animate-in slide-in-from-bottom-3 ${
              t.type === "success"
                ? "bg-emerald-950 text-emerald-50 border-emerald-700/80 shadow-emerald-950/20"
                : t.type === "error"
                ? "bg-rose-950 text-rose-50 border-rose-700/80 shadow-rose-950/20"
                : "bg-slate-950 text-slate-50 border-slate-700/80 shadow-slate-950/20"
            }`}
          >
            <div className="flex items-center gap-3">
              {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {t.type === "error" && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              {t.type === "info" && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
              <span className="leading-snug">{t.text}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {t.undoAction && (
                <button
                  type="button"
                  onClick={() => {
                    t.undoAction?.();
                    removeToast(t.id);
                  }}
                  className="min-h-[36px] px-2.5 py-1 text-xs underline font-bold hover:bg-white/10 rounded-lg transition-colors text-emerald-300 active:scale-95"
                >
                  Desfazer
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Fechar notificação"
                className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
