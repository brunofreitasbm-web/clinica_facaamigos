"use client";

import { useRef, useState, useTransition } from "react";
import { createResourceBooking } from "./actions";

export function BookResourceForm({
  resources,
  defaultDate,
}: {
  resources: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createResourceBooking(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        });
      }}
    >
      <select name="resource_id" required className="input" defaultValue="">
        <option value="" disabled>
          Recurso
        </option>
        {resources.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <input type="date" name="date" required defaultValue={defaultDate} className="input" />
      <input type="time" name="start_time" required className="input" aria-label="Início" />
      <input type="time" name="end_time" required className="input" aria-label="Fim" />
      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Reservando…" : "Reservar"}
      </button>
      {error && <p className="text-xs sm:col-span-5" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </form>
  );
}
