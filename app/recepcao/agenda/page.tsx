import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";
import { type AgendaAppointment } from "./day-grid";
import { AppointmentForm } from "./appointment-form";
import { AgendaClient } from "./agenda-client";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const day = date ?? todayInTimeZone(CLINIC_TIMEZONE);

  const supabase = createAdminClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name");

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .order("full_name");

  // Limites do dia civil (em CLINIC_TIMEZONE), convertidos pro instante UTC
  // correspondente — nunca strings ingênuas de UTC.
  const dayStart = zonedDateTimeToUtc(day, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(day), "00:00", CLINIC_TIMEZONE).toISOString();

  // Nota: `appointments` tem duas FKs para `profiles` (therapist_id e
  // cancelled_by), então o Postgrest recusa o embed `profiles(...)` por
  // ambiguidade. Usar o nome da COLUNA da FK (`profiles!coluna`) com alias
  // desambigua e dá nome estável pra cada relação no resultado.
  const { data: rawAppointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, room_id, checkin_at, checkout_at, cancel_reason, rooms(name), therapist:profiles!therapist_id(full_name), canceller:profiles!cancelled_by(full_name), patients(full_name)",
    )
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  const appointments: AgendaAppointment[] = (rawAppointments ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    roomId: a.room_id,
    roomName: (a.rooms as { name: string } | null)?.name ?? "",
    therapistName: (a.therapist as { full_name: string } | null)?.full_name ?? "",
    patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
    status: a.status,
    checkinAt: a.checkin_at,
    checkoutAt: a.checkout_at,
    cancelReason: a.cancel_reason,
    cancelledByName: (a.canceller as { full_name: string } | null)?.full_name ?? null,
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
        <AppointmentForm
          patients={patients ?? []}
          therapists={therapists ?? []}
          rooms={rooms ?? []}
          defaultDate={day}
        />
        <AgendaClient rooms={rooms ?? []} appointments={appointments} />
      </div>
    </main>
  );
}
