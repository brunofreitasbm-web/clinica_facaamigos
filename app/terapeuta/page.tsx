import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RealtimeAppointmentToast } from "@/components/realtime-appointment-toast";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";
import { TodaySessionsList } from "./today-sessions-list";

export const dynamic = "force-dynamic";

export default async function TerapeutaPage({
  searchParams,
}: {
  searchParams: Promise<{ therapist?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  // Gestor/supervisor têm visão ampla por clinic_id (PRD §4) e podem
  // escolher qual terapeuta olhar. Terapeuta só vê a própria agenda — sem
  // seletor, sem possibilidade de ver de outro. Qualquer outro papel aqui
  // não deveria acontecer (o proxy.ts já restringe por ROLE_HOME), mas
  // negamos acesso defensivamente.
  const canChooseTherapist = profile?.role === "gestor" || profile?.role === "supervisor";

  if (!profile || (profile.role !== "terapeuta" && !canChooseTherapist)) {
    redirect("/");
  }

  let therapists: { id: string; full_name: string }[] | null = null;
  let therapistId: string;

  if (canChooseTherapist) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name");
    therapists = data;

    const { therapist: requestedTherapistId } = await searchParams;
    therapistId =
      therapists?.some((t) => t.id === requestedTherapistId)
        ? requestedTherapistId!
        : (therapists?.[0]?.id ?? "");
  } else {
    therapistId = profile.id;
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const dayStart = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(today), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: todaySessions } = therapistId
    ? await supabase
        .from("appointments")
        .select("id, starts_at, status, checkin_at, attendance_started_at, checkout_at, patients(full_name)")
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

  // Reavaliação semestral (PRD §2): refresh_reassessment_alerts() (pg_cron
  // diário) já marca como 'notificado' quem entrou na janela de
  // antecedência — aqui só listamos, sem recalcular nada. A RLS de
  // reassessment_alerts já restringe a pacientes vinculados a este
  // terapeuta (ou clínica inteira, se gestor/supervisor).
  const { data: reassessmentAlerts } = await supabase
    .from("reassessment_alerts")
    .select("id, due_date, patients(full_name)")
    .eq("status", "notificado")
    .order("due_date");

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title="Minhas sessões de hoje"
        description="Evoluções pendentes aparecem primeiro — meta é registrar em até 2 minutos."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        {canChooseTherapist && (
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
        )}

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
                    {new Date(a.starts_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
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
            Reavaliações a vencer
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(reassessmentAlerts ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-paper-line-strong bg-status-pending-soft px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">
                  {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                </span>
                <span className="text-status-pending-text">
                  até {new Date(`${a.due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
            {(reassessmentAlerts ?? []).length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma reavaliação a vencer.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Sessões de hoje
          </h2>
          <TodaySessionsList
            sessions={(todaySessions ?? []).map((a) => ({
              id: a.id,
              startsAt: a.starts_at,
              patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
              status: a.status,
              checkinAt: a.checkin_at,
              attendanceStartedAt: a.attendance_started_at,
              checkoutAt: a.checkout_at,
            }))}
          />
        </section>
      </div>
      {/* Só a sessão real do próprio terapeuta (não a visão "ver como" de
          gestor/supervisor) recebe o toast de chegada na recepção. */}
      {!canChooseTherapist && <RealtimeAppointmentToast therapistId={profile.id} />}
    </main>
  );
}
