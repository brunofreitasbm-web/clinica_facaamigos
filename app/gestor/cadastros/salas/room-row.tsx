"use client";

import { useState, useTransition } from "react";
import { updateRoom, deleteRoom } from "./actions";
import type { RoomRow, SpecialtyOption } from "./types";

export function RoomRowItem({ room, specialties }: { room: RoomRow; specialties: SpecialtyOption[] }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluationRoom, setIsEvaluationRoom] = useState(room.isEvaluationRoom);
  const [capacity, setCapacity] = useState(room.capacity);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr>
        <td colSpan={6}>
          <form
            className="flex flex-col gap-2 py-2"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await updateRoom(room.id, formData);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setEditing(false);
              });
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" name="name" required defaultValue={room.name} className="input" />
              <input
                type="number"
                name="capacity"
                required
                min={1}
                value={isEvaluationRoom ? 1 : capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                disabled={isEvaluationRoom}
                title={isEvaluationRoom ? "Sala de Avaliação atende 1 paciente por vez." : undefined}
                className="input w-24"
              />
              <input
                type="number"
                name="recommendedInterns"
                min={0}
                defaultValue={room.recommendedInterns ?? ""}
                placeholder="Estagiários"
                title="Recomendado: 1 estagiário por criança. Deixe em branco se não aplicável."
                className="input w-24"
              />
              <select name="specialtyId" defaultValue={room.specialtyId ?? ""} className="input" title="Especialidade vinculada à sala">
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
                  <input type="checkbox" name="isAbaTraining" defaultChecked={room.isAbaTraining} />
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
                    setCapacity(room.capacity);
                    setIsEvaluationRoom(room.isEvaluationRoom);
                    setEditing(false);
                  }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
            {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-semibold text-sm">{room.name}</td>
      <td>{room.capacity} pessoa(s)</td>
      <td className="text-xs text-ink-faint">
        {room.recommendedInterns != null ? `${room.recommendedInterns} estagiário(s)` : "—"}
      </td>
      <td className="text-xs text-ink-faint">{specialties.find((s) => s.id === room.specialtyId)?.label ?? "—"}</td>
      <td className="text-xs text-ink-faint">
        {[room.isAbaTraining && "Treino ABA", room.isEvaluationRoom && "Avaliação"].filter(Boolean).join(" · ") || "—"}
      </td>
      <td className="text-right">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-chart">
          Editar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            if (!confirm(`Excluir a sala "${room.name}"?`)) return;
            startTransition(async () => {
              const result = await deleteRoom(room.id);
              if (!result.success) setError(result.error);
            });
          }}
          className="ml-3 text-xs text-status-negative-text"
        >
          Excluir
        </button>
        {error && <p className="mt-1 text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
      </td>
    </tr>
  );
}
