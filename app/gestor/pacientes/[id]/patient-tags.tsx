"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addPatientTag, removePatientTag } from "./actions";

export type PatientTagRow = { id: string; label: string };

export function PatientTags({ patientId, tags }: { patientId: string; tags: PatientTagRow[] }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="tag-status st-em-atendimento inline-flex items-center gap-1.5"
        >
          {tag.label}
          <button
            type="button"
            aria-label={`Remover tag ${tag.label}`}
            className="opacity-60 hover:opacity-100"
            onClick={() => startTransition(() => { removePatientTag(patientId, tag.id); })}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {adding ? (
        <form
          className="flex items-center gap-2"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await addPatientTag(patientId, formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setAdding(false);
            });
          }}
        >
          <input
            name="label"
            autoFocus
            required
            placeholder="Nome da tag"
            className="input h-8 w-36 text-xs"
          />
          <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
            Salvar
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setAdding(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary text-xs" onClick={() => setAdding(true)}>
          <Plus size={14} />
          Adicionar Tag
        </button>
      )}
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
