import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { computeJourney, type Journey } from "@/lib/patient-journey-pure";

type PatientCore = { id: string; status: string; evaluated_at: string | null; first_session_at: string | null };

/**
 * Status real do paciente (quadro "Próximo passo"). Lê só o que a RLS do
 * viewer permitir: sem acesso à esteira/guias, cai no status do paciente
 * (quem tem prontuário já foi promovido pelo plano autorizado).
 */
export async function getPatientJourney(supabase: SupabaseClient<Database>, patient: PatientCore): Promise<Journey> {
  const [{ data: evaluations }, { data: drafts }, { data: activeAuth }] = await Promise.all([
    supabase.from("appointments").select("starts_at, status").eq("patient_id", patient.id).eq("is_evaluation", true),
    supabase
      .from("registration_drafts")
      .select("guide_sent_at, plan_authorized_at, authorization_waived, scheduling_enabled_at")
      .eq("patient_id", patient.id)
      .neq("status", "rejected"),
    supabase
      .from("authorizations")
      .select("id, patient_insurance!inner(patient_id)")
      .eq("patient_insurance.patient_id", patient.id)
      .eq("status", "ativa")
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = drafts ?? [];
  return computeJourney({
    patient,
    planAuthorizedByDraft: rows.some((d) => d.plan_authorized_at || d.authorization_waived || d.scheduling_enabled_at),
    guideSent: rows.some((d) => d.guide_sent_at),
    authorizationWaived: rows.some((d) => d.authorization_waived),
    hasActiveAuthorization: !!activeAuth,
    evaluations: evaluations ?? [],
    formatDateTime: (iso) => fmtDateTime(iso, CLINIC_TIMEZONE),
  });
}
