"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  text: string;
  type: ToastType;
  undoAction?: () => void;
}

interface ToastContextType {
  toast: (text: string, type?: ToastType, undoAction?: () => void) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((text: string, type: ToastType = "success", undoAction?: () => void) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type, undoAction }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Container de Toasts flutuantes não-bloqueantes */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-200 animate-in slide-in-from-bottom-2 ${
              t.type === "success"
                ? "bg-emerald-900 text-emerald-50 border-emerald-700 dark:bg-emerald-950 dark:border-emerald-800"
                : t.type === "error"
                ? "bg-rose-900 text-rose-50 border-rose-700"
                : "bg-slate-900 text-slate-50 border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {t.type === "info" && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
              <span>{t.text}</span>
            </div>

            <div className="flex items-center gap-2">
              {t.undoAction && (
                <button
                  onClick={() => {
                    t.undoAction?.();
                    removeToast(t.id);
                  }}
                  className="text-xs underline font-semibold hover:opacity-80 transition-opacity text-emerald-300"
                >
                  Desfazer
                </button>
              )}
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100 p-0.5 rounded transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
