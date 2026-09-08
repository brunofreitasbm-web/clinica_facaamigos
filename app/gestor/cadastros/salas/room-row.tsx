"use client";

import { useState, useTransition } from "react";
import { updateRoom, deleteRoom } from "./actions";
import type { RoomRow } from "./types";

export function RoomRowItem({ room }: { room: RoomRow }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr>
        <td colSpan={3}>
          <form
            className="flex flex-wrap items-center gap-2 py-1"
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
            <input type="text" name="name" required defaultValue={room.name} className="input" />
            <input type="number" name="capacity" required min={1} defaultValue={room.capacity} className="input w-24" />
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">
              Cancelar
            </button>
            {error && <p className="text-xs w-full" style={{ color: "var(--status-falta)" }}>{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-semibold text-sm">{room.name}</td>
      <td>{room.capacity} pessoa(s)</td>
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
