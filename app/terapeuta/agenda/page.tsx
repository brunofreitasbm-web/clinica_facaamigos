import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TerapeutaBottomNav } from "@/components/terapeuta-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone } from "@/lib/timezone";
import { addCalendarDays, buildWeek, weekBounds, buildMonthGrid, monthGridBounds } from "@/lib/calendar-grid";
import { AgendaToolbar, type AgendaView } from "./agenda-toolbar";
import { DayAgendaList } from "./day-agenda-list";
import { WeekAgenda } from "./week-agenda";
import { MonthAgenda } from "./month-agenda";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseView(raw: string | undefined): AgendaView {
  return raw === "semana" || raw === "mes" ? raw : "dia";
}

function parseDate(raw: string | undefined, fallback: string): string {
  return raw && DATE_RE.test(raw) ? raw : fallback;
}

export default async function TerapeutaAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; therapist?: string }>;
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

  // Mesma regra de app/terapeuta/page.tsx: terapeuta só vê a própria agenda;
  // gestor/supervisor podem escolher qual terapeuta olhar via ?therapist=.
  const canChooseTherapist = profile?.role === "gestor" || profile?.role === "supervisor";
  if (!profile || (profile.role !== "terapeuta" && !canChooseTherapist)) {
    redirect("/");
  }

  let therapists: { id: string; full_name: string }[] | null = null;
  let therapistId: string;
  const params = await searchParams;

  if (canChooseTherapist) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name");
    therapists = data;
    therapistId = therapists?.some((t) => t.id === params.therapist) ? params.therapist! : (therapists?.[0]?.id ?? "");
  } else {
    therapistId = profile.id;
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const view = parseView(params.view);
  const anchor = parseDate(params.date, today);
  const therapistQs = canChooseTherapist ? therapistId : "";

  // Uma única query por range — nunca busca o mês inteiro pra filtrar o dia.
  let rangeStart: string;
  let rangeEnd: string;
  let rangeLabel: string;
  const week = buildWeek(anchor);
  const monthGrid = buildMonthGrid(anchor);

  if (view === "dia") {
    rangeStart = anchor;
    rangeEnd = addCalendarDays(anchor, 1);
    rangeLabel = new Date(`${anchor}T12:00:00`).toLocaleDateString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } else if (view === "semana") {
    const bounds = weekBounds(week);
    rangeStart = bounds.start;
    rangeEnd = bounds.end;
    rangeLabel = week.rangeLabel;
  } else {
    const bounds = monthGridBounds(monthGrid);
    rangeStart = bounds.start;
    rangeEnd = bounds.end;
    rangeLabel = monthGrid.monthLabel;
  }

  const rangeStartUtc = zonedDateTimeToUtc(rangeStart, "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEndUtc = zonedDateTimeToUtc(rangeEnd, "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: rows } = therapistId
    ? await supabase
        .from("appointments")
        .select(
          "id, patient_id, starts_at, ends_at, discipline, status, checkin_at, attendance_started_at, checkout_at, is_evaluation, is_provisional, patients(full_name), rooms(name)",
        )
        .eq("therapist_id", therapistId)
        .gte("starts_at", rangeStartUtc)
        .lt("starts_at", rangeEndUtc)
        .order("starts_at")
    : { data: null };

  const appointments = (rows ?? []).map((a) => ({
    id: a.id,
    patientId: a.patient_id,
    isEvaluation: a.is_evaluation,
    isProvisional: a.is_provisional,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    discipline: a.discipline,
    roomName: (a.rooms as { name: string } | null)?.name ?? null,
    patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
    status: a.status,
    checkinAt: a.checkin_at,
    attendanceStartedAt: a.attendance_started_at,
    checkoutAt: a.checkout_at,
  }));

  // Badge de evolução pendente: só faz sentido no dia (a sessão precisa já
  // ter sido realizada) e limitado ao range buscado — nunca a vida inteira
  // do terapeuta (ver plano: evita N+1 e queries fora de escopo).
  const realizedIdsInRange = appointments.filter((a) => a.status === "realizada").map((a) => a.id);
  const { data: existingNotes } = realizedIdsInRange.length
    ? await supabase.from("session_notes").select("appointment_id").in("appointment_id", realizedIdsInRange)
    : { data: null };
  const notedIds = new Set((existingNotes ?? []).map((n) => n.appointment_id));
  const pendingNoteIds = realizedIdsInRange.filter((id) => !notedIds.has(id));

  const qs = therapistQs ? `&therapist=${therapistQs}` : "";
  const prevAnchor = view === "dia" ? addCalendarDays(anchor, -1) : view === "semana" ? addCalendarDays(anchor, -7) : addCalendarDays(anchor, -30);
  const nextAnchor = view === "dia" ? addCalendarDays(anchor, 1) : view === "semana" ? addCalendarDays(anchor, 7) : addCalendarDays(anchor, 30);

  return (
    <main className="flex flex-1 flex-col pb-24 md:pb-10">
      <PageHeader axisLabel="Terapeuta" title="Minha agenda" description="" />

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-5 sm:max-w-[1100px] sm:px-10">
        {canChooseTherapist && (
          <form className="flex items-center gap-2" method="get">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="date" value={anchor} />
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

        <AgendaToolbar
          view={view}
          date={anchor}
          rangeLabel={rangeLabel}
          therapistParam={therapistQs}
          prevHref={`/terapeuta/agenda?view=${view}&date=${prevAnchor}${qs}`}
          nextHref={`/terapeuta/agenda?view=${view}&date=${nextAnchor}${qs}`}
          todayHref={`/terapeuta/agenda?view=${view}&date=${today}${qs}`}
        />

        {view === "dia" && (
          <DayAgendaList sessions={appointments} pendingNoteIds={pendingNoteIds} isToday={anchor === today} />
        )}
        {view === "semana" && <WeekAgenda week={week} appointments={appointments} />}
        {view === "mes" && (
          <MonthAgenda grid={monthGrid} appointments={appointments} todayIso={today} therapistParam={therapistQs} />
        )}
      </div>

      <TerapeutaBottomNav active="agenda" />
    </main>
  );
}
