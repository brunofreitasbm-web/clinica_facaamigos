export type AgendaAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  roomName: string;
  therapistName: string;
  patientName: string;
  status: string;
  checkinAt: string | null;
  checkoutAt: string | null;
  cancelReason: string | null;
  cancelledByName: string | null;
};

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08h–19h

export const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta_familia: "Falta",
  cancelada_familia: "Cancelada",
  cancelada_terapeuta: "Cancelada",
  cancelada_clinica: "Cancelada",
  remarcada: "Remarcada",
};

export function DayGrid({
  rooms,
  appointments,
}: {
  rooms: { id: string; name: string }[];
  appointments: AgendaAppointment[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-paper-line-strong bg-paper/60">
      <div
        className="grid min-w-[600px]"
        style={{ gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)` }}
      >
        <div className="border-b border-r border-paper-line-strong" />
        {rooms.map((room) => (
          <div
            key={room.id}
            className="border-b border-r border-paper-line-strong px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft last:border-r-0"
          >
            {room.name}
          </div>
        ))}
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b border-r border-paper-line-strong px-2 py-3 font-mono text-xs text-ink-faint">
              {String(hour).padStart(2, "0")}:00
            </div>
            {rooms.map((room) => {
              const match = appointments.find((a) => {
                const startHour = new Date(a.startsAt).getHours();
                return a.roomId === room.id && startHour === hour;
              });
              return (
                <div
                  key={room.id}
                  className="min-h-14 border-b border-r border-paper-line-strong p-1 last:border-r-0"
                >
                  {match && (
                    <div className="rounded bg-chart-soft px-2 py-1 text-xs">
                      <p className="font-medium text-ink">{match.patientName}</p>
                      <p className="text-ink-soft">{match.therapistName}</p>
                      <p className="text-ink-faint">{STATUS_LABEL[match.status] ?? match.status}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
