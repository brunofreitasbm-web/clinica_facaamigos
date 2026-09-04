import { redirect } from "next/navigation";
import { RealtimeAppointmentToast } from "@/components/realtime-appointment-toast";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";
import { TodaySessionsList } from "./today-sessions-list";

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

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
        .select(
          "id, starts_at, ends_at, discipline, status, checkin_at, attendance_started_at, checkout_at, patients(full_name), rooms(name)",
        )
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

  const viewingTherapistName = canChooseTherapist
    ? (therapists?.find((t) => t.id === therapistId)?.full_name ?? profile.full_name)
    : profile.full_name;
  const firstName = viewingTherapistName.split(" ")[0] ?? viewingTherapistName;

  const todayLabel = capitalize(
    new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "short",
    }),
  ).replace(/\.$/, "");

  const pendingNoteIds = pending.map((a) => a.id);

  return (
    <main className="flex flex-1 flex-col">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-3.5 px-5 pb-5 pt-7 sm:px-10"
      >
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none" aria-hidden>
            <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-bg)" />
            <path
              d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
              fill="var(--color-accent-2)"
            />
            <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
          </svg>
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[15px] font-semibold">
            Faça Amigos{" "}
            <span style={{ color: "var(--color-accent-2)" }} className="font-normal italic">
              · Terapeuta
            </span>
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs opacity-75">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#7fc79a" }} />
            sincronizado
          </span>
        </div>
        <div>
          <div className="text-xs opacity-70">{todayLabel}</div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-[28px] font-semibold leading-tight text-inherit"
          >
            Olá, {firstName}
          </h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-7 px-5 pb-28 pt-6 sm:px-10 sm:pb-10">
        {canChooseTherapist && (
          <form className="flex items-center gap-2" method="get">
            <select name="therapist" defaultValue={therapistId} className="input">
              {(therapists ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">
              Ver como
            </button>
          </form>
        )}

        {pending.length > 0 && (
          <a
            href="#pendencias"
            className="flex items-center gap-3 px-4 py-3.5 no-underline"
            style={{ background: "var(--status-agendada-bg)", borderRadius: "var(--radius-md)" }}
          >
            <span
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2-700)" }}
              className="text-[26px] font-semibold leading-none"
            >
              {pending.length}
            </span>
            <span className="text-sm leading-snug" style={{ color: "var(--color-accent-2-800)" }}>
              <strong>{pending.length === 1 ? "evolução pendente" : "evoluções pendentes"}</strong>
              <br />
              sessões realizadas sem registro
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 256 256"
              fill="none"
              className="ml-auto shrink-0"
              aria-hidden
            >
              <path
                d="M96 48l80 80-80 80"
                stroke="var(--color-accent-2-700)"
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}

        <section>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Sessões de hoje
          </h6>
          <TodaySessionsList
            sessions={(todaySessions ?? []).map((a) => ({
              id: a.id,
              startsAt: a.starts_at,
              endsAt: a.ends_at,
              discipline: a.discipline,
              roomName: (a.rooms as { name: string } | null)?.name ?? null,
              patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
              status: a.status,
              checkinAt: a.checkin_at,
              attendanceStartedAt: a.attendance_started_at,
              checkoutAt: a.checkout_at,
            }))}
            pendingNoteIds={pendingNoteIds}
          />
        </section>

        <section id="pendencias">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Evoluções pendentes
          </h6>
          <div className="flex flex-col">
            {pending.map((a) => (
              <a
                key={a.id}
                href={`/terapeuta/evolucao/${a.id}`}
                className="flex items-center justify-between gap-3 border-b py-3 text-sm no-underline"
                style={{ borderColor: "var(--color-divider)" }}
              >
                <span className="font-medium text-ink">
                  {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                </span>
                <span className="tag-status st-agendada">
                  {new Date(a.starts_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                </span>
              </a>
            ))}
            {pending.length === 0 && (
              <p className="text-sm text-ink-faint">Nenhuma evolução pendente.</p>
            )}
          </div>
        </section>

        <section>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Reavaliações a vencer
          </h6>
          <div className="flex flex-col">
            {(reassessmentAlerts ?? []).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 border-b py-3 text-sm"
                style={{ borderColor: "var(--color-divider)" }}
              >
                <span className="font-medium text-ink">
                  {(a.patients as { full_name: string } | null)?.full_name ?? ""}
                </span>
                <span className="tag-status st-agendada">
                  até {new Date(`${a.due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
            {(reassessmentAlerts ?? []).length === 0 && (
              <p className="text-sm text-ink-faint">Nenhuma reavaliação a vencer.</p>
            )}
          </div>
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t bg-white py-2.5 text-[11px] sm:hidden"
        style={{ borderColor: "var(--color-divider)" }}
      >
        <a
          href="/terapeuta"
          className="flex flex-col items-center gap-1 no-underline"
          style={{ color: "var(--color-accent)", fontWeight: 600 }}
        >
          📅 Hoje
        </a>
        <span className="flex flex-col items-center gap-1" style={{ color: "var(--color-neutral-500)" }}>
          👥 Pacientes
        </span>
        <a
          href="#pendencias"
          className="flex flex-col items-center gap-1 no-underline"
          style={{ color: "var(--color-neutral-600)" }}
        >
          📈 Pendências
        </a>
      </nav>

      {/* Só a sessão real do próprio terapeuta (não a visão "ver como" de
          gestor/supervisor) recebe o toast de chegada na recepção. */}
      {!canChooseTherapist && <RealtimeAppointmentToast therapistId={profile.id} />}
    </main>
  );
}
