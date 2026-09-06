"use client";

import { useState, useTransition } from "react";
import { confirmAttendance } from "./actions";

export function ConfirmAttendance({ appointmentId }: { appointmentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <div style={{ color: "var(--color-teal-300)", fontSize: 13 }}>✓ Presença confirmada.</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-gold"
        style={{ minHeight: 44 }}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await confirmAttendance(appointmentId);
            if (!result.success) {
              setError(result.error);
              return;
            }
            setDone(true);
          });
        }}
      >
        {isPending ? "Confirmando…" : "Confirmar presença"}
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}
