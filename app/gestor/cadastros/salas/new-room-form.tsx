"use client";

import { useRef, useState, useTransition } from "react";
import { createRoom } from "./actions";

export function NewRoomForm() {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        + Nova sala
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto_auto]"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createRoom(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          setOpen(false);
        });
      }}
    >
      <input type="text" name="name" required placeholder="Nome da sala" className="input" />
      <input type="number" name="capacity" required min={1} defaultValue={1} placeholder="Capacidade" className="input" />
      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
        Cancelar
      </button>
      {error && <p className="text-xs sm:col-span-4" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </form>
  );
}
