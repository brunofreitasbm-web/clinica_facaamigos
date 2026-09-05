"use client";

import { useState, useTransition } from "react";
import { createInsurerQuick } from "./actions";

export function NewInsurerDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden>
          <path d="M128 40v176M40 128h176" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
        </svg>
        Convênio
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Novo convênio</h2>
            <form
              className="flex flex-col gap-3"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await createInsurerQuick(formData);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  close();
                });
              }}
            >
              <div className="field">
                <label htmlFor="insurer-name">Nome do convênio</label>
                <input id="insurer-name" name="name" required className="input" placeholder="Ex.: Amazônia Saúde" />
              </div>

              {error && (
                <p className="text-xs" style={{ color: "var(--status-falta)" }}>
                  {error}
                </p>
              )}

              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={close}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
