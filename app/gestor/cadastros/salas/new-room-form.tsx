"use client";

import { useRef, useState, useTransition } from "react";
import { createRoom } from "./actions";
import type { SpecialtyOption } from "./types";

export function NewRoomForm({ specialties }: { specialties: SpecialtyOption[] }) {
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
      className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] sm:items-center"
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
      <input
        type="number"
        name="recommendedInterns"
        min={0}
        placeholder="Estagiários (recomendado)"
        title="Recomendado: 1 estagiário por criança. Deixe em branco se não aplicável."
        className="input"
      />
      <select name="specialtyId" defaultValue="" className="input" title="Especialidade vinculada à sala">
        <option value="">Sem especialidade</option>
        {specialties.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <label className="radio whitespace-nowrap" style={{ fontSize: 13 }} title="Salas de Treino ABA são as únicas em que se pode abrir turma">
        <input type="checkbox" name="isAbaTraining" />
        <span className="dot" style={{ borderRadius: 2 }} />
        Sala de Treino ABA
      </label>
      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
        Cancelar
      </button>
      {error && <p className="text-xs sm:col-span-7" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </form>
  );
}
