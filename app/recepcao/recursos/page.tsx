import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, civilDateInTimeZone } from "@/lib/timezone";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/resource-categories";
import { NewResourceForm } from "./new-resource-form";
import { BookResourceForm } from "./book-resource-form";
import { ResourceBookingsList, type ResourceBookingRow } from "./resource-bookings-list";

export const dynamic = "force-dynamic";

export default async function RecursosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canManageResources = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    canManageResources = profile?.role === "gestor" || profile?.role === "supervisor";
  }

  const { data: resources } = await supabase
    .from("resources")
    .select("id, name, category, notes")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const now = new Date();
  const in14Days = civilDateInTimeZone(new Date(now.getTime() + 14 * 86_400_000), CLINIC_TIMEZONE);

  const { data: bookingsRaw } = await supabase
    .from("resource_bookings")
    .select("id, starts_at, ends_at, resources(name), profiles!booked_by(full_name)")
    .eq("status", "reservado")
    .gte("starts_at", `${today}T00:00:00`)
    .lte("starts_at", `${in14Days}T23:59:59`)
    .order("starts_at");

  const bookings: ResourceBookingRow[] = (bookingsRaw ?? []).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    resourceName: (Array.isArray(b.resources) ? b.resources[0]?.name : b.resources?.name) ?? "Recurso",
    bookedByName:
      (Array.isArray(b.profiles) ? b.profiles[0]?.full_name : b.profiles?.full_name) ?? "—",
  }));

  return (
    <main className="flex flex-1 flex-col pb-16">
      <div className="px-10 pt-9">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          Recepção
        </h6>
        <h1 className="m-0">Recursos e reservas</h1>
        <p className="mt-2 max-w-[640px] text-sm text-ink-soft">
          Brinquedos sensoriais, testes padronizados e pranchas de comunicação — reserva com bloqueio automático de
          conflito de horário. Salas continuam reservadas junto com a sessão, na Agenda.
        </p>
      </div>

      <div className="px-10 pt-8">
        <div className="card max-w-[900px]">
          <div className="flex items-center justify-between gap-3">
            <div className="card-kicker">Recursos cadastrados</div>
            {canManageResources && <NewResourceForm />}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(resources ?? []).map((r) => (
              <div key={r.id} className="rounded-md border border-paper-line-strong bg-paper px-4 py-3 text-sm">
                <p className="font-medium text-ink">{r.name}</p>
                <p className="text-xs text-ink-faint">{RESOURCE_CATEGORY_LABEL[r.category] ?? r.category}</p>
                {r.notes && <p className="mt-1 text-xs text-ink-soft">{r.notes}</p>}
              </div>
            ))}
            {(resources ?? []).length === 0 && (
              <p className="text-sm text-ink-faint">Nenhum recurso cadastrado ainda.</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-10 pt-8">
        <div className="card max-w-[900px]">
          <div className="card-kicker">Reservar</div>
          <BookResourceForm resources={(resources ?? []).map((r) => ({ id: r.id, name: r.name }))} defaultDate={today} />
        </div>
      </div>

      <div className="px-10 pt-8">
        <div className="card max-w-[900px]">
          <div className="card-kicker">Próximas reservas · 14 dias</div>
          <ResourceBookingsList bookings={bookings} />
        </div>
      </div>
    </main>
  );
}
