// app/recepcao/agenda/agenda-client.tsx
"use client";

import { useState } from "react";
import { DayGrid, type AgendaAppointment } from "./day-grid";
import { AppointmentPanel } from "./appointment-panel";

export function AgendaClient({
  rooms,
  appointments,
}: {
  rooms: { id: string; name: string }[];
  appointments: AgendaAppointment[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  return (
    <>
      <DayGrid rooms={rooms} appointments={appointments} onSelect={setSelectedId} />
      {selected && <AppointmentPanel appointment={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
