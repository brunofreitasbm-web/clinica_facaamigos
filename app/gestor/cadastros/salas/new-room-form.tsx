"use client";

import { useRef, useState, useTransition } from "react";
import { createRoom } from "./actions";
import type { SpecialtyOption } from "./types";

export function NewRoomForm({ specialties }: { specialties: SpecialtyOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isEvaluationRoom, setIsEvaluationRoom] = useState(false);
  const [capacity, setCapacity] = useState(1);
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
      className="flex flex-col gap-3 rounded-lg border border-ink-faint/20 p-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createRoom(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          setCapacity(1);
          setIsEvaluationRoom(false);
          setOpen(false);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1.5fr]">
        <input type="text" name="name" required placeholder="Nome da sala" className="input" />
        <input
          type="number"
          name="capacity"
          required
          min={1}
          value={isEvaluationRoom ? 1 : capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          disabled={isEvaluationRoom}
          title={isEvaluationRoom ? "Sala de Avaliação atende 1 paciente por vez." : undefined}
          placeholder="Capacidade"
          className="input"
        />
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
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <label className="radio whitespace-nowrap" style={{ fontSize: 13 }} title="Salas de Treino ABA são as únicas em que se pode abrir turma">
            <input type="checkbox" name="isAbaTraining" />
            <span className="dot" style={{ borderRadius: 2 }} />
            Sala de Treino ABA
          </label>
          <label className="radio whitespace-nowrap" style={{ fontSize: 13 }} title="Sala usada para avaliação (ex: avaliação neuropsicológica)">
            <input
              type="checkbox"
              name="isEvaluationRoom"
              checked={isEvaluationRoom}
              onChange={(e) => setIsEvaluationRoom(e.target.checked)}
            />
            <span className="dot" style={{ borderRadius: 2 }} />
            Sala de Avaliação
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCapacity(1);
              setIsEvaluationRoom(false);
              setOpen(false);
            }}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>
      {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </form>
  );
}
