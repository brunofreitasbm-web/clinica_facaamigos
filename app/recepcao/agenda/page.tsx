import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { DayGrid, type AgendaAppointment } from "./day-grid";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);

  const supabase = createAdminClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const dayStart = `${day}T00:00:00`;
  const dayEnd = `${day}T23:59:59`;

  // Nota: `appointments` tem duas FKs para `profiles` (therapist_id e
  // cancelled_by), então o Postgrest recusa o embed `profiles(...)` por
  // ambiguidade. Usar o nome da COLUNA da FK (`profiles!therapist_id`)
  // desambigua sem depender do nome exato da constraint no banco.
  const { data: rawAppointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, room_id, rooms(name), profiles!therapist_id(full_name), patients(full_name)",
    )
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  const appointments: AgendaAppointment[] = (rawAppointments ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    roomId: a.room_id,
    roomName: (a.rooms as { name: string } | null)?.name ?? "",
    therapistName:
      (a.profiles as { full_name: string } | null)?.full_name ?? "",
    patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
    status: a.status,
  }));

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Agenda do dia"
        description={`Sessões de ${day.split("-").reverse().join("/")}, por sala.`}
      />
      <div className="flex flex-col gap-4 p-6 sm:p-10">
        <form className="flex items-center gap-2" method="get">
          <input
            type="date"
            name="date"
            defaultValue={day}
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="rounded-md border border-paper-line-strong px-3 py-2 text-sm text-ink hover:border-chart"
          >
            Ver dia
          </button>
        </form>
        <DayGrid rooms={rooms ?? []} appointments={appointments} />
      </div>
    </main>
  );
}
