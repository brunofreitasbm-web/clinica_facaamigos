import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { listOverdueSessionNotes } from "@/lib/session-note-pending";
import {
  currentWeek,
  weekBounds,
  classifyAppointmentKind,
  dayIndexInWeek,
  timeLabel,
  GRID_EXCLUDED_STATUSES,
} from "./grade-data";
import { GradePanel, type GradeAppointment, type PendingNote } from "./grade-panel";
import { PlanosPanel, type PlanRow } from "./planos-panel";
import { InboxPanel, type InboxMessageRow } from "./inbox-panel";
import { SupervisaoShell } from "./supervisao-shell";

export const dynamic = "force-dynamic";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function SupervisaoPage() {
  const supabase = await createClient();

  const week = currentWeek(todayInTimeZone(CLINIC_TIMEZONE));
  const bounds = weekBounds(week);
  const weekStartIso = zonedDateTimeToUtc(bounds.start, "00:00", CLINIC_TIMEZONE).toISOString();
  const weekEndIso = zonedDateTimeToUtc(bounds.end, "00:00", CLINIC_TIMEZONE).toISOString();

  const [
    { count: activePatientsCount },
    { count: dueReassessments },
    { data: therapists },
    { data: rooms },
    { data: rawAppointments },
    pendingNotes,
    { data: rawPlans },
    { data: rawMessages },
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("reassessment_alerts").select("id", { count: "exact", head: true }).eq("status", "notificado"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name"),
    supabase.from("rooms").select("id, name").eq("clinic_id", DEV_CLINIC_ID).order("name"),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, discipline, is_evaluation, is_provisional, room_id, therapist_id, rooms(name), therapist:profiles!therapist_id(full_name), patients(full_name)",
      )
      .gte("starts_at", weekStartIso)
      .lt("starts_at", weekEndIso)
      .order("starts_at", { ascending: true }),
    listOverdueSessionNotes(supabase),
    supabase
      .from("treatment_plans")
      .select("id, version, patient_id, patients(full_name), plan_goals(id, description, domain, criterion, status, discipline)")
      .eq("status", "rascunho")
      .order("version", { ascending: false }),
    supabase
      .from("messages")
      .select("id, patient_id, guardian_id, body, sent_at, read_at, patients(full_name)")
      .eq("channel", "portal")
      .eq("direction", "inbound")
      .order("sent_at", { ascending: false }),
  ]);

  // ── Grade semanal ──────────────────────────────────────────────────────
  const weekAppointments = (rawAppointments ?? []).filter((a) => !GRID_EXCLUDED_STATUSES.includes(a.status));

  const gradeAppointments: GradeAppointment[] = weekAppointments
    .map((a) => {
      const dayIndex = dayIndexInWeek(a.starts_at, week, CLINIC_TIMEZONE);
      if (dayIndex < 0) return null; // sessão de fim de semana — a grade só mostra Seg-Sex
      const therapist = Array.isArray(a.therapist) ? a.therapist[0] : a.therapist;
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const room = Array.isArray(a.rooms) ? a.rooms[0] : a.rooms;
      return {
        id: a.id,
        dayIndex,
        timeLabel: timeLabel(a.starts_at, CLINIC_TIMEZONE),
        patientName: patient?.full_name ?? "—",
        therapistId: a.therapist_id,
        therapistName: therapist?.full_name ?? "—",
        roomId: a.room_id,
        roomName: room?.name ?? "—",
        kind: classifyAppointmentKind({
          isEvaluation: a.is_evaluation,
          isProvisional: a.is_provisional,
          discipline: a.discipline,
        }),
      };
    })
    .filter((a): a is GradeAppointment => a !== null);

  const pendingNoteRows: PendingNote[] = pendingNotes.map((p) => ({
    appointmentId: p.appointmentId,
    therapistName: p.therapistName,
    patientName: p.patientName,
    hoursOverdue: p.hoursOverdue,
  }));

  // "Evolução em 24h": das sessões `realizada` desta semana, quantas já têm
  // session_notes registrada em até 24h depois do horário da sessão.
  const realizedThisWeek = weekAppointments.filter((a) => a.status === "realizada");
  let onTimePercent: number | null = null;
  if (realizedThisWeek.length > 0) {
    const { data: notes } = await supabase
      .from("session_notes")
      .select("appointment_id, created_at_server")
      .in(
        "appointment_id",
        realizedThisWeek.map((a) => a.id),
      );
    const earliestNoteByAppointment = new Map<string, string>();
    for (const note of notes ?? []) {
      const current = earliestNoteByAppointment.get(note.appointment_id);
      if (!current || note.created_at_server < current) {
        earliestNoteByAppointment.set(note.appointment_id, note.created_at_server);
      }
    }
    const onTime = realizedThisWeek.filter((a) => {
      const noteAt = earliestNoteByAppointment.get(a.id);
      if (!noteAt) return false;
      return new Date(noteAt).getTime() - new Date(a.starts_at).getTime() <= 24 * 60 * 60 * 1000;
    }).length;
    onTimePercent = Math.round((onTime / realizedThisWeek.length) * 100);
  }

  const carteira = {
    sessionsInGrid: weekAppointments.length,
    provisionalNoGuide: weekAppointments.filter((a) => a.is_provisional).length,
    onTimePercent,
  };

  // ── Planos terapêuticos pendentes ──────────────────────────────────────
  const plans: PlanRow[] = (rawPlans ?? []).map((plan) => {
    const patient = Array.isArray(plan.patients) ? plan.patients[0] : plan.patients;
    const goals = plan.plan_goals ?? [];
    return {
      id: plan.id,
      patientName: patient?.full_name ?? "—",
      version: plan.version,
      disciplines: Array.from(new Set(goals.map((g) => g.discipline))),
      goals: goals.map((g) => ({
        id: g.id,
        description: g.description,
        domain: g.domain,
        criterion: g.criterion,
        status: g.status,
      })),
    };
  });

  // ── Caixa de entrada (mensagens do portal) ─────────────────────────────
  const inboxMessages: InboxMessageRow[] = (rawMessages ?? []).map((m) => {
    const patient = Array.isArray(m.patients) ? m.patients[0] : m.patients;
    return {
      id: m.id,
      patientId: m.patient_id,
      guardianId: m.guardian_id,
      patientName: patient?.full_name ?? "—",
      body: m.body ?? "",
      whenLabel: m.sent_at ? fmtDateTime(m.sent_at) : "—",
      resolved: !!m.read_at,
    };
  });

  return (
    <SupervisaoShell
      nPlanos={plans.length}
      nInbox={inboxMessages.filter((m) => !m.resolved).length}
      gradeTab={
        <GradePanel
          weekLabel={week.rangeLabel}
          weekNumber={week.weekNumber}
          activePatientsCount={activePatientsCount ?? 0}
          dueReassessments={dueReassessments ?? 0}
          therapists={(therapists ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
          rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
          appointments={gradeAppointments}
          pendingNotes={pendingNoteRows}
          carteira={carteira}
        />
      }
      planosTab={<PlanosPanel plans={plans} />}
      inboxTab={<InboxPanel messages={inboxMessages} />}
    />
  );
}
