import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { listOverdueSessionNotes } from "@/lib/session-note-pending";
import { listOverduePlans } from "@/lib/pdi-pending";
import { getPendingPatients } from "@/lib/patient-stage";
import { ABSENCE_REASON_LABEL } from "@/lib/absence-reasons";
import {
  currentWeek,
  weekBounds,
  classifyAppointmentKind,
  dayIndexInWeek,
  timeLabel,
  GRID_EXCLUDED_STATUSES,
} from "./grade-data";
import { GradePanel, type GradeAppointment, type PendingNote, type PendingPlan } from "./grade-panel";
import { PlanosPanel, type PlanRow } from "./planos-panel";
import { InboxPanel, type InboxMessageRow, type ReassessmentRow, type PendingReportRow, type AbsenceReportRow } from "./inbox-panel";
import type { NpsAlertRow } from "./nps-alerts-panel";
import { SupervisaoShell } from "./supervisao-shell";
import { FluxosPanel, type FlowPatient, type FlowCounters } from "./fluxos-panel";
import { AnamnesisValidationPanel } from "@/components/anamnesis-validation-panel";

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
    pendingPlans,
    { data: rawPlans },
    { data: rawMessages },
    { data: rawReassessments },
    { data: rawDraftReports },
    onboardingPatients,
    { data: rawActivePatients },
    { data: rawAbsenceReports },
    { data: rawNpsAlerts },
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
    listOverduePlans(supabase),
    supabase
      .from("treatment_plans")
      .select(
        "id, version, patient_id, general_objective, family_priorities, patients(full_name), plan_goals(id, description, domain, criterion, status, discipline, horizon, strategy, methodology, supervisor_notes)",
      )
      .eq("status", "rascunho")
      .order("version", { ascending: false }),
    supabase
      .from("messages")
      .select("id, patient_id, guardian_id, body, sent_at, read_at, patients(full_name)")
      .eq("channel", "portal")
      .eq("direction", "inbound")
      .order("sent_at", { ascending: false }),
    supabase
      .from("reassessment_alerts")
      .select("id, due_date, status, patients(full_name)")
      .eq("status", "notificado")
      .order("due_date", { ascending: true }),
    supabase
      .from("draft_reports")
      .select(
        "id, patient_id, final_text, ai_draft, status, patients(full_name), generated_by_profile:profiles!draft_reports_generated_by_fkey(full_name)",
      )
      .in("status", ["gerado", "em_revisao"])
      .order("created_at", { ascending: true }),
    // Aba Fluxos: todo paciente ainda em onboarding (threshold 0 = sem filtro
    // de dias), com o estágio já calculado pela mesma regra da recepção.
    getPendingPatients(supabase, 0),
    supabase
      .from("patients")
      .select("id, full_name, status")
      .eq("clinic_id", DEV_CLINIC_ID)
      .in("status", ["ativo", "pausado"])
      .order("full_name"),
    // Notificações / quadro de ausências informadas pela família
    supabase
      .from("absence_reports")
      .select(
        "id, appointment_id, reason_category, reason_text, attachment_storage_path, status, created_at, resolved_at, appointments(id, starts_at, discipline, patients(full_name), therapist:profiles!therapist_id(full_name))",
      )
      .order("created_at", { ascending: false }),
    // Alertas de insatisfação (NPS) — triagem de detrator é atendimento à
    // família, tratada aqui junto com o resto da caixa de entrada.
    supabase
      .from("nps_surveys")
      .select(
        "id, score, feedback_text, alert_status, dispatched_at, responded_at, patients(full_name), guardians(full_name)",
      )
      .in("alert_status", ["pending_contact", "em_atendimento"])
      .order("responded_at", { ascending: false }),
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

  const pendingPlanRows: PendingPlan[] = pendingPlans.map((p) => ({
    patientId: p.patientId,
    patientName: p.patientName,
    daysOverdue: p.daysOverdue,
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
      generalObjective: plan.general_objective,
      familyPriorities: plan.family_priorities,
      disciplines: Array.from(new Set(goals.map((g) => g.discipline))),
      goals: goals.map((g) => ({
        id: g.id,
        description: g.description,
        domain: g.domain,
        criterion: g.criterion,
        status: g.status,
        horizon: g.horizon,
        strategy: g.strategy,
        methodology: g.methodology,
        supervisorNotes: g.supervisor_notes,
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

  // ── Alertas de reavaliação vencendo (reassessment_alerts) ──────────────
  const todayStr = todayInTimeZone(CLINIC_TIMEZONE);
  const reassessmentRows: ReassessmentRow[] = (rawReassessments ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const daysLeft = Math.round(
      (new Date(`${r.due_date}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    return {
      id: r.id,
      patientName: patient?.full_name ?? "—",
      dueDate: new Date(`${r.due_date}T00:00:00`).toLocaleDateString("pt-BR"),
      daysLeft,
    };
  });

  // ── Relatórios devolutivos aguardando validação (draft_reports) ────────
  const pendingReportRows: PendingReportRow[] = (rawDraftReports ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const generatedBy = Array.isArray(r.generated_by_profile) ? r.generated_by_profile[0] : r.generated_by_profile;
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.full_name ?? "—",
      generatedByName: generatedBy?.full_name ?? "—",
      text: r.final_text ?? r.ai_draft ?? "",
    };
  });

  // ── Quadro de Avisos / Ausências informadas pela família ───────────────
  const absenceReportRows: AbsenceReportRow[] = (rawAbsenceReports ?? []).map((rep) => {
    const appt = Array.isArray(rep.appointments) ? rep.appointments[0] : rep.appointments;
    const patient = appt && (Array.isArray(appt.patients) ? appt.patients[0] : appt.patients);
    const therapist = appt && (Array.isArray(appt.therapist) ? appt.therapist[0] : appt.therapist);

    const sessionDate = appt?.starts_at ? fmtDateTime(appt.starts_at) : "—";
    const createdAtLabel = rep.created_at ? fmtDateTime(rep.created_at) : "—";

    return {
      id: rep.id,
      appointmentId: rep.appointment_id,
      patientName: patient?.full_name ?? "—",
      therapistName: therapist?.full_name ?? "—",
      discipline: appt?.discipline ?? "Sessão",
      sessionDateLabel: sessionDate,
      reasonCategory: rep.reason_category,
      reasonCategoryLabel: ABSENCE_REASON_LABEL[rep.reason_category] ?? rep.reason_category,
      reasonText: rep.reason_text ?? null,
      attachmentStoragePath: rep.attachment_storage_path ?? null,
      status: rep.status as "em_analise" | "aprovado" | "rejeitado",
      createdAtLabel,
      resolved: !!rep.resolved_at,
    };
  });

  // ── Alertas de insatisfação (NPS) ───────────────────────────────────────
  const npsAlerts: NpsAlertRow[] = (rawNpsAlerts ?? []).map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const guardian = Array.isArray(a.guardians) ? a.guardians[0] : a.guardians;
    return {
      id: a.id,
      patientName: patient?.full_name ?? "Paciente",
      guardianName: guardian?.full_name ?? null,
      score: a.score,
      feedbackText: a.feedback_text,
      alertStatus: a.alert_status as NpsAlertRow["alertStatus"],
      dateLabel: a.responded_at
        ? new Date(a.responded_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })
        : new Date(a.dispatched_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
    };
  });

  // ── Fluxos (passo a passo com atalhos) ─────────────────────────────────
  const flowPatients: FlowPatient[] = [
    ...onboardingPatients.map((p) => ({ id: p.id, name: p.full_name, status: p.status, stage: p.stage })),
    ...(rawActivePatients ?? []).map((p) => ({ id: p.id, name: p.full_name, status: p.status, stage: 5 as const })),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const pendingAbsencesCount = absenceReportRows.filter((a) => !a.resolved).length;
  const openFamilyMessages = inboxMessages.filter((m) => !m.resolved).length + pendingAbsencesCount + npsAlerts.length;
  const flowCounters: FlowCounters = {
    leads: onboardingPatients.filter((p) => p.stage === 1).length,
    stuckOnboarding: onboardingPatients.filter((p) => p.daysSinceCreated >= 3).length,
    awaitingEvaluation: onboardingPatients.filter((p) => p.stage === 2).length,
    evaluatedNoGuide: onboardingPatients.filter((p) => p.stage === 3).length,
    sessionsInGrid: carteira.sessionsInGrid,
    provisionalNoGuide: carteira.provisionalNoGuide,
    pendingNotes: pendingNoteRows.length,
    pendingPlans: pendingPlanRows.length,
    plansToApprove: plans.length,
    reassessmentsDue: reassessmentRows.length,
    openFamilyMessages,
    pendingReports: pendingReportRows.length,
  };
  const nFluxos =
    flowCounters.stuckOnboarding +
    flowCounters.evaluatedNoGuide +
    flowCounters.provisionalNoGuide +
    flowCounters.openFamilyMessages;

  return (
    <SupervisaoShell
      nPlanos={plans.length}
      nInbox={openFamilyMessages}
      nFluxos={nFluxos}
      triagensTab={<AnamnesisValidationPanel />}
      fluxosTab={<FluxosPanel patients={flowPatients} counters={flowCounters} />}
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
          pendingPlans={pendingPlanRows}
          carteira={carteira}
        />
      }
      planosTab={<PlanosPanel plans={plans} />}
      inboxTab={
        <InboxPanel
          messages={inboxMessages}
          reassessments={reassessmentRows}
          pendingReports={pendingReportRows}
          absenceReports={absenceReportRows}
          npsAlerts={npsAlerts}
        />
      }
    />
  );
}
