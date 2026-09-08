"use client";

import { useState, useTransition } from "react";
import { deleteAppointmentType } from "./actions";

export function DeleteAppointmentTypeButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        className="btn btn-ghost text-xs"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Excluir o tipo de atendimento "${name}"? Essa ação não pode ser desfeita.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteAppointmentType(id);
            if (!result.success) setError(result.error);
          });
        }}
      >
        {isPending ? "Excluindo…" : "Excluir"}
      </button>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}
    </span>
  );
}
