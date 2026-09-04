"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "./documents-actions";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

export function DocumentUploadForm({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper"
      >
        + Anexar documento
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="grid grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:grid-cols-2"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await uploadDocument(patientId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          setOpen(false);
        });
      }}
    >
      <input
        type="file"
        name="file"
        required
        accept="image/*,application/pdf"
        capture="environment"
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm sm:col-span-2"
      />
      <select
        name="category"
        required
        defaultValue=""
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Categoria
        </option>
        {DOCUMENT_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="valid_until"
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
        aria-label="Validade (opcional)"
      />
      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
        <input type="checkbox" name="shared_with_family" className="h-4 w-4" />
        Compartilhar com a família (aparece no portal)
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Enviando…" : "Enviar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text sm:col-span-2">{error}</p>}
    </form>
  );
}
