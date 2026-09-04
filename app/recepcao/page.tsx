import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import {
  zonedDateTimeToUtc,
  todayInTimeZone,
  nextCalendarDay,
  civilDateInTimeZone,
} from "@/lib/timezone";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { NovaSessaoDialog, type GuideSummary } from "./nova-sessao-dialog";
import { TodayAgendaList, type TodaySession } from "./today-agenda-list";

export const dynamic = "force-dynamic";

const WEEKDAY_PT: Record<string, string> = {
  Sunday: "Domingo",
  Monday: "Segunda",
  Tuesday: "Terça",
  Wednesday: "Quarta",
  Thursday: "Quinta",
  Friday: "Sexta",
  Saturday: "Sábado",
};
const MONTH_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekdayEn = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${WEEKDAY_PT[weekdayEn] ?? weekdayEn}, ${d} ${MONTH_PT[m - 1]} ${y}`;
}

function fmtShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export default async function RecepcaoPage() {
  const supabase = await createClient();

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const dayStart = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(today), "00:00", CLINIC_TIMEZONE).toISOString();
  const now = new Date();
  const sevenDaysStr = civilDateInTimeZone(new Date(now.getTime() + 7 * 86_400_000), CLINIC_TIMEZONE);

  const [{ data: rooms }, { data: patients }, { data: therapists }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("clinic_id", DEV_CLINIC_ID).order("name"),
    supabase.from("patients").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name"),
  ]);

  // Nota: `appointments` tem duas FKs pra `profiles` (therapist_id e
  // cancelled_by) — o embed `profiles(...)` sem alias é ambíguo pro
  // PostgREST, então usamos `profiles!coluna` (mesmo padrão de
  // app/recepcao/agenda/page.tsx).
  const { data: rawAppointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, room_id, discipline, checkin_at, attendance_started_at, checkout_at, confirmed_at, cancelled_at, cancel_reason, rooms(name), therapist:profiles!therapist_id(full_name), patients(full_name)",
    )
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd)
    .order("starts_at", { ascending: true });

  const appointments = (rawAppointments ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    roomId: a.room_id,
    roomName: (a.rooms as { name: string } | null)?.name ?? "",
    discipline: a.discipline,
    therapistName: (a.therapist as { full_name: string } | null)?.full_name ?? "",
    patientName: (a.patients as { full_name: string } | null)?.full_name ?? "",
    checkinAt: a.checkin_at,
    attendanceStartedAt: a.attendance_started_at,
    checkoutAt: a.checkout_at,
    confirmedAt: a.confirmed_at,
    cancelledAt: a.cancelled_at,
    cancelReason: a.cancel_reason,
  }));

  const sessions: TodaySession[] = appointments.map((a) => ({
    id: a.id,
    patientName: a.patientName,
    discipline: a.discipline,
    therapistName: a.therapistName,
    roomName: a.roomName,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    status: a.status,
    checkinAt: a.checkinAt,
    attendanceStartedAt: a.attendanceStartedAt,
    checkoutAt: a.checkoutAt,
  }));

  // ── Guias vencendo · 7 dias + mapa paciente→guia ativa (preview no diálogo
  // "Nova sessão") — duas leituras da mesma autorização ativa, sem 2º nível
  // de filtro embutido no Postgrest (evitamos `patient_insurance.patients.…`,
  // que não é garantido; seguimos o padrão de lib/patient-stage.ts: filtra
  // clinic_id na tabela-base e junta o resto em JS).
  const patientIds = (patients ?? []).map((p) => p.id);
  const { data: patientInsurances } = patientIds.length
    ? await supabase
        .from("patient_insurance")
        .select("id, patient_id, insurers(name)")
        .in("patient_id", patientIds)
    : { data: [] as { id: string; patient_id: string; insurers: { name: string } | { name: string }[] | null }[] };

  const insuranceIds = (patientInsurances ?? []).map((pi) => pi.id);
  const { data: activeAuths } = insuranceIds.length
    ? await supabase
        .from("authorizations")
        .select("id, patient_insurance_id, guide_number, sessions_used, sessions_authorized, valid_to")
        .in("patient_insurance_id", insuranceIds)
        .eq("status", "ativa")
    : { data: [] as { id: string; patient_insurance_id: string; guide_number: string | null; sessions_used: number; sessions_authorized: number; valid_to: string }[] };

  const insuranceById = new Map((patientInsurances ?? []).map((pi) => [pi.id, pi]));
  const patientNameById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));

  const guidesByPatient: Record<string, GuideSummary> = {};
  const expiringGuides: { patientName: string; insurerName: string; sessionsUsed: number; sessionsAuthorized: number; validTo: string }[] = [];

  for (const auth of activeAuths ?? []) {
    const insurance = insuranceById.get(auth.patient_insurance_id);
    if (!insurance) continue;
    const insurerName =
      (Array.isArray(insurance.insurers) ? insurance.insurers[0]?.name : insurance.insurers?.name) ?? "Convênio";
    const summary: GuideSummary = {
      insurerName,
      guideNumber: auth.guide_number,
      sessionsUsed: auth.sessions_used,
      sessionsAuthorized: auth.sessions_authorized,
      validTo: auth.valid_to,
    };
    guidesByPatient[insurance.patient_id] = summary;
    if (auth.valid_to >= today && auth.valid_to <= sevenDaysStr) {
      expiringGuides.push({
        patientName: patientNameById.get(insurance.patient_id) ?? "—",
        insurerName,
        sessionsUsed: auth.sessions_used,
        sessionsAuthorized: auth.sessions_authorized,
        validTo: auth.valid_to,
      });
    }
  }
  expiringGuides.sort((a, b) => a.validTo.localeCompare(b.validTo));

  // ── Salas agora — quem está fisicamente na sala (checkin sem checkout);
  // sem ninguém no local, mostra a próxima sessão já em curso no horário.
  const roomsNow = (rooms ?? []).map((room) => {
    const roomAppointments = appointments.filter((a) => a.roomId === room.id);
    const inRoom = roomAppointments.find((a) => a.checkinAt && !a.checkoutAt);
    const scheduledNow =
      inRoom ??
      roomAppointments.find(
        (a) =>
          (a.status === "agendada" || a.status === "confirmada") &&
          new Date(a.startsAt) <= now &&
          now < new Date(a.endsAt),
      );
    return {
      id: room.id,
      name: room.name,
      who: scheduledNow ? `${scheduledNow.patientName} · ${scheduledNow.therapistName}` : "Livre",
    };
  });

  // ── Rastro do dia — trilha de atividade derivada dos timestamps de cada
  // sessão de hoje (confirmação/check-in/check-out/cancelamento). Não existe
  // uma tabela `audit_log` genérica ainda no schema; quando houver, trocar
  // esta derivação por uma consulta a ela.
  type LogEvent = { at: string; msg: string };
  const logEvents: LogEvent[] = [];
  for (const a of appointments) {
    if (a.confirmedAt) logEvents.push({ at: a.confirmedAt, msg: `${a.patientName} confirmou presença` });
    if (a.checkinAt) logEvents.push({ at: a.checkinAt, msg: `Check-in de ${a.patientName}` });
    if (a.checkoutAt) logEvents.push({ at: a.checkoutAt, msg: `Sessão de ${a.patientName} concluída` });
    if (a.cancelledAt) {
      const label = APPOINTMENT_STATUS_STYLE[a.status]?.label ?? a.status;
      logEvents.push({ at: a.cancelledAt, msg: `${a.patientName} — ${label}` });
    }
  }
  logEvents.sort((a, b) => b.at.localeCompare(a.at));
  const log = logEvents.slice(0, 8).map((e) => ({
    t: new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TIMEZONE }),
    msg: e.msg,
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-7 px-10"
      >
        <Link href="/recepcao" className="mr-auto flex items-center gap-3 no-underline">
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden>
            <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-bg)" />
            <path
              d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
              fill="var(--color-accent-2)"
            />
            <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
          </svg>
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
            Faça Amigos{" "}
            <span style={{ color: "var(--color-accent-2)" }} className="font-normal italic">
              · Recepção
            </span>
          </span>
        </Link>
        <nav className="flex gap-6 text-[15px]">
          <span
            style={{ borderBottom: "2px solid var(--color-accent-2)" }}
            className="py-5 text-white"
          >
            Agenda
          </span>
          <Link href="/recepcao/pacientes" className="py-5 text-inherit no-underline opacity-70 hover:opacity-100">
            Pacientes
          </Link>
          <span className="py-5 opacity-40">Guias</span>
          <span className="py-5 opacity-40">Documentos</span>
        </nav>
        <div className="flex items-center gap-3.5 text-[13px] opacity-85">
          <span>{fmtDateLabel(today)}</span>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--color-accent-2)",
              color: "var(--color-accent)",
              display: "grid",
              placeItems: "center",
              fontWeight: 600,
            }}
          >
            R
          </span>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-14 px-10 pb-16 pt-9 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3.5">
            <div>
              <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1.5">
                Hoje · {sessions.length} sessões
              </h6>
              <h1 className="m-0">Agenda do dia</h1>
            </div>
            <NovaSessaoDialog
              patients={patients ?? []}
              therapists={therapists ?? []}
              rooms={rooms ?? []}
              guidesByPatient={guidesByPatient}
              defaultDate={today}
            />
          </div>

          <TodayAgendaList sessions={sessions} />
        </section>

        <aside className="flex flex-col gap-10 pt-2">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3.5">
              Guias vencendo · 7 dias
            </h6>
            <div className="flex flex-col gap-3.5">
              {expiringGuides.length === 0 && (
                <p className="text-sm text-ink-faint">Nenhuma guia vencendo nos próximos 7 dias.</p>
              )}
              {expiringGuides.map((g, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <div>
                    <div style={{ fontFamily: "var(--font-heading)" }} className="text-[15px] font-semibold">
                      {g.patientName}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-neutral-600)" }}>
                      {g.insurerName} · {g.sessionsUsed} de {g.sessionsAuthorized} sessões
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs" style={{ color: "var(--color-accent-2-700)" }}>
                    até {fmtShortDate(g.validTo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3.5">
              Salas agora
            </h6>
            <div className="grid grid-cols-2 gap-2.5">
              {roomsNow.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-1"
                  style={{ padding: "12px 14px", background: "var(--color-surface)", borderRadius: 2 }}
                >
                  <span className="text-xs" style={{ color: "var(--color-neutral-600)" }}>
                    {r.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-heading)" }} className="text-sm font-semibold">
                    {r.who}
                  </span>
                </div>
              ))}
              {roomsNow.length === 0 && <p className="text-sm text-ink-faint">Nenhuma sala cadastrada.</p>}
            </div>
          </div>

          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3.5">
              Rastro do dia
            </h6>
            <div className="flex flex-col gap-2.5 text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
              {log.length === 0 && <p className="text-ink-faint">Nenhuma atividade registrada ainda hoje.</p>}
              {log.map((l, i) => (
                <div key={i} className="grid gap-2.5" style={{ gridTemplateColumns: "44px 1fr" }}>
                  <span style={{ color: "var(--color-neutral-500)" }}>{l.t}</span>
                  <span>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
