"use client";

import { useRef, useState, useTransition } from "react";
import { createResource } from "./actions";
import { RESOURCE_CATEGORIES } from "@/lib/resource-categories";

export function NewResourceForm() {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        + Novo recurso
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_2fr_auto_auto]"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createResource(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          setOpen(false);
        });
      }}
    >
      <input type="text" name="name" required placeholder="Nome do recurso" className="input" />
      <select name="category" required defaultValue="" className="input">
        <option value="" disabled>
          Categoria
        </option>
        {RESOURCE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input type="text" name="notes" placeholder="Observações (opcional)" className="input" />
      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
        Cancelar
      </button>
      {error && <p className="text-xs sm:col-span-5" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </form>
  );
}
