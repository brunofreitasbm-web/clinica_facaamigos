"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Confirmação simples para as poucas ações da Fila de entrada que não têm "Desfazer". */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="m-0 text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="m-0 text-sm text-slate-700">{children}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex min-h-10 items-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {pending ? "Salvando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
