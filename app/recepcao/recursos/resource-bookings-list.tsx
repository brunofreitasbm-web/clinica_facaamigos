"use client";

import { useState, useTransition } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { cancelResourceBooking } from "./actions";

export type ResourceBookingRow = {
  id: string;
  resourceName: string;
  startsAt: string;
  endsAt: string;
  bookedByName: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResourceBookingsList({ bookings }: { bookings: ResourceBookingRow[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  function cancel(id: string) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setActiveId(id);
    startTransition(async () => {
      const result = await cancelResourceBooking(id);
      if (!result.success) setErrors((prev) => ({ ...prev, [id]: result.error }));
      setActiveId(null);
    });
  }

  if (bookings.length === 0) {
    return <p className="text-sm text-ink-faint">Nenhuma reserva nos próximos 14 dias.</p>;
  }

  return (
    <ul className="flex flex-col">
      {bookings.map((b) => (
        <li
          key={b.id}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b py-3"
          style={{ borderColor: "var(--color-divider)" }}
        >
          <div>
            <span className="font-semibold">{b.resourceName}</span>
            <span className="ml-2 text-xs text-ink-faint">
              {fmt(b.startsAt)} – {fmt(b.endsAt)}
            </span>
          </div>
          <span className="text-xs text-ink-soft">{b.bookedByName}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => cancel(b.id)}
            className="btn btn-ghost text-xs"
          >
            {isPending && activeId === b.id ? "…" : "Cancelar"}
          </button>
          {errors[b.id] && <p className="col-span-3 text-xs text-status-negative-text">{errors[b.id]}</p>}
        </li>
      ))}
    </ul>
  );
}
