import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { FrequencyDay, GoalRow, EvolutionNote, BillingRow } from "@/components/prontuario/patient-tabs";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { getPatientAbaLearningCurves } from "@/lib/patient-metrics";
import type { ProgramTrialSummary } from "@/components/prontuario/aba-learning-curve-chart";
import { fmtDate as fmtDateShared } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";
import type { SessionNoteStructured } from "@/lib/session-note-fields";

const fmtDate = (iso: string | null | undefined) => fmtDateShared(iso, CLINIC_TIMEZONE);

export type DocumentRow = {
  id: string;
  category: string;
  uploadedAt: string;
  validUntil: string | null;
  sharedWithFamily: boolean;
};

export type UpcomingAppointment = {
  id: string;
  startsAt: string;
  discipline: string;
  therapistName: string;
};

export type PatientDossier = {
  frequency: FrequencyDay[];
  goals: GoalRow[];
  planStatusLabel: string | null;
  notes: EvolutionNote[];
  documents: DocumentRow[];
  teamText: string[];
  billing: BillingRow[] | null;
  abaPrograms: ProgramTrialSummary[];
  upcoming: UpcomingAppointment[];
};

/**
 * Conteúdo das abas do prontuário (visão geral, evolução, plano, ABA,
 * documentos, financeiro) — extraído de app/recepcao/pacientes/[id]/page.tsx
 * pra ser reusado pela ficha do terapeuta (app/terapeuta/paciente/
 * [patientId]/page.tsx) sem duplicar as ~10 queries.
 *
 * `includeBilling: false` faz a query de billing_items nem ser emitida —
 * "terapeuta não pode ver valores de convênio" (PRD §4) vira ausência de
 * dado, não um filtro de CSS que um DevTools desliga.
 */
export async function getPatientDossier(
  supabase: SupabaseClient<Database>,
  patientId: string,
  opts: { includeBilling: boolean; notesLimit?: number },
): Promise<PatientDossier> {
  const notesLimit = opts.notesLimit ?? 10;

  const [
    { data: recentAppointments },
    { data: treatmentPlan },
    { data: teamAccess },
    { data: documentsRaw },
    { data: notesRaw },
    { data: upcomingRaw },
    billingResult,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", patientId)
      .order("starts_at", { ascending: false })
      .limit(20),
    supabase
      .from("treatment_plans")
      .select("id, status, approved_at, version")
      .eq("patient_id", patientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("patient_access")
      .select("id, profile_id, profiles!profile_id(full_name, council_type)")
      .eq("patient_id", patientId)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null),
    supabase
      .from("documents")
      .select("id, category, uploaded_at, valid_until, shared_with_family")
      .eq("patient_id", patientId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("session_notes")
      .select(
        "id, version, structured, free_text, appointment_id, appointments!inner(patient_id, starts_at), profiles!session_notes_therapist_id_fkey(full_name)",
      )
      .eq("appointments.patient_id", patientId)
      .order("created_at_server", { ascending: false })
      .limit(notesLimit),
    supabase
      .from("appointments")
      .select("id, starts_at, discipline, profiles!therapist_id(full_name)")
      .eq("patient_id", patientId)
      .gte("starts_at", new Date().toISOString())
      .not("status", "in", `(${CANCELLED_APPOINTMENT_STATUSES.join(",")})`)
      .order("starts_at", { ascending: true })
      .limit(10),
    opts.includeBilling
      ? supabase
          .from("billing_items")
          .select("id, amount, status, appointment_id, appointments!inner(patient_id, starts_at, discipline)")
          .eq("appointments.patient_id", patientId)
          .order("starts_at", { foreignTable: "appointments", ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
  ]);

  const { data: goals } = treatmentPlan
    ? await supabase
        .from("plan_goals")
        .select("id, description, domain, criterion, status")
        .eq("treatment_plan_id", treatmentPlan.id)
    : { data: [] as { id: string; description: string; domain: string; criterion: string | null; status: string }[] };

  const frequency: FrequencyDay[] = (recentAppointments ?? [])
    .slice()
    .reverse()
    .map((a) => ({
      id: a.id,
      colorVar: (APPOINTMENT_STATUS_STYLE[a.status] ?? APPOINTMENT_STATUS_STYLE.agendada).colorVar,
      title: `${fmtDate(a.starts_at)} · ${(APPOINTMENT_STATUS_STYLE[a.status] ?? {}).label ?? a.status}`,
    }));

  const goalRows: GoalRow[] = (goals ?? []).map((g) => ({
    id: g.id,
    title: g.description,
    domain: g.domain,
    criterion: g.criterion,
    status: g.status,
  }));

  const planStatusLabel = treatmentPlan
    ? treatmentPlan.status === "aprovado" && treatmentPlan.approved_at
      ? `aprovado ${fmtDate(treatmentPlan.approved_at)}`
      : treatmentPlan.status
    : null;

  const notes: EvolutionNote[] = (notesRaw ?? []).map((n) => ({
    id: n.id,
    date: fmtDate(n.appointments!.starts_at),
    version: n.version,
    therapistName: (Array.isArray(n.profiles) ? n.profiles[0]?.full_name : n.profiles?.full_name) ?? "—",
    freeText: n.free_text,
    structured: n.structured as SessionNoteStructured | null,
    appointmentId: n.appointment_id,
  }));

  const documents: DocumentRow[] = (documentsRaw ?? []).map((d) => ({
    id: d.id,
    category: d.category,
    uploadedAt: d.uploaded_at,
    validUntil: d.valid_until,
    sharedWithFamily: d.shared_with_family,
  }));

  const teamText = (teamAccess ?? []).map((t) => {
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    return `${profile?.full_name ?? "—"}${profile?.council_type ? ` · ${profile.council_type}` : ""}`;
  });

  const billing: BillingRow[] | null = billingResult.data
    ? billingResult.data.map((b) => ({
        id: b.id,
        date: fmtDate(b.appointments!.starts_at),
        discipline: b.appointments!.discipline,
        amount: b.amount,
        status: b.status,
      }))
    : null;

  const abaPrograms = await getPatientAbaLearningCurves(supabase, patientId);

  const upcoming: UpcomingAppointment[] = (upcomingRaw ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    discipline: a.discipline,
    therapistName: (Array.isArray(a.profiles) ? a.profiles[0]?.full_name : a.profiles?.full_name) ?? "—",
  }));

  return { frequency, goals: goalRows, planStatusLabel, notes, documents, teamText, billing, abaPrograms, upcoming };
}
