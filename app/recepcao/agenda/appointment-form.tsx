"use client";

import { useState, useTransition } from "react";
import { createAppointment } from "./actions";

export function AppointmentForm({
  patients,
  therapists,
  rooms,
  defaultDate,
}: {
  patients: { id: string; full_name: string }[];
  therapists: { id: string; full_name: string }[];
  rooms: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper"
      >
        + Agendar sessão
      </button>
    );
  }

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:grid-cols-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createAppointment(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setOpen(false);
        });
      }}
    >
      <select name="patient_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
        <option value="">Paciente</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name}</option>
        ))}
      </select>
      <select name="therapist_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
        <option value="">Terapeuta</option>
        {therapists.map((t) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <select name="room_id" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm">
        <option value="">Sala</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <input type="date" name="date" required defaultValue={defaultDate} className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
      <input type="time" name="time" required className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
      <input type="text" name="discipline" required placeholder="Disciplina (ex: aba)" className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm" />
      <div className="flex gap-2 sm:col-span-3">
        <button type="submit" disabled={isPending} className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
          {isPending ? "Agendando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text sm:col-span-3">{error}</p>}
    </form>
  );
}
