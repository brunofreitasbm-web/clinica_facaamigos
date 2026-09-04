import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";

export default async function TerapeutaPage({
  searchParams,
}: {
  searchParams: Promise<{ therapist?: string }>;
}) {
  const supabase = createAdminClient();

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .order("full_name");

  const { therapist } = await searchParams;
  const therapistId = therapist ?? therapists?.[0]?.id ?? "";

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const dayStart = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(today), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: todaySessions } = therapistId
    ? await supabase
        .from("appointments")
        .select("id, starts_at, status, patients(full_name)")
        .eq("therapist_id", therapistId)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .order("starts_at")
    : { data: null };

  const { data: realizedSessions } = therapistId
    ? await supabase
        .from("appointments")
        .select("id, starts_at, patients(full_name)")
        .eq("therapist_id", therapistId)
        .eq("status", "realizada")
        .order("starts_at", { ascending: true })
    : { data: null };

  const realizedIds = (realizedSessions ?? []).map((a) => a.id);

  const { data: existingNotes } = realizedIds.length
    ? await supabase.from("session_notes").select("appointment_id").in("appointment_id", realizedIds)
    : { data: null };

  const notedIds = new Set((existingNotes ?? []).map((n) => n.appointment_id));
  const pending = (realizedSessions ?? []).filter((a) => !notedIds.has(a.id));

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title="Minhas sessões de hoje"
        description="Evoluções pendentes aparecem primeiro — meta é registrar em até 2 minutos."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <form className="flex items-center gap-2" method="get">
          <select
            name="therapist"
            defaultValue={therapistId}
            className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          >
            {(therapists ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-paper-line-strong px-3 py-2 text-sm text-ink hover:border-chart"
          >
            Ver como
          </button>
        </form>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Evoluções pendentes
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pending.map((a) => (
              <li key={a.id}>
                <a
                  href={`/terapeuta/evolucao/${a.id}`}
                  className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm hover:border-chart"
                >
                  <span className="font-medium text-ink">
                    {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                  </span>
                  <span className="text-ink-faint">
                    {new Date(a.starts_at).toLocaleDateString("pt-BR")}
                  </span>
                </a>
              </li>
            ))}
            {pending.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma evolução pendente.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Sessões de hoje
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(todaySessions ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">
                  {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                </span>
                <span className="text-ink-faint">
                  {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: CLINIC_TIMEZONE,
                  })}
                </span>
              </li>
            ))}
            {(todaySessions ?? []).length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma sessão hoje.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
