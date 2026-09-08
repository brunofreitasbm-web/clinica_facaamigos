import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SociallySavvyResponses, SociallySavvyResults, SociallySavvyStatus } from "@/lib/socially-savvy";

type Supa = SupabaseClient<Database>;

export type SociallySavvyAssessmentRow = {
  id: string;
  round: number;
  status: SociallySavvyStatus;
  assessmentDate: string;
  assessedById: string;
  assessedByName: string;
  responses: SociallySavvyResponses;
  results: Partial<SociallySavvyResults>;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  round: number;
  status: string;
  assessment_date: string;
  assessed_by: string;
  responses: unknown;
  results: unknown;
  observations: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
}): SociallySavvyAssessmentRow {
  const assessor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    round: row.round,
    status: row.status as SociallySavvyStatus,
    assessmentDate: row.assessment_date,
    assessedById: row.assessed_by,
    assessedByName: assessor?.full_name ?? "—",
    responses: (row.responses as SociallySavvyResponses) ?? {},
    results: (row.results as Partial<SociallySavvyResults>) ?? {},
    observations: row.observations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, round, status, assessment_date, assessed_by, responses, results, observations, created_at, updated_at, profiles!assessed_by(full_name)";

/** Todas as aplicações do paciente, da 1ª à 4ª — o eixo do consolidado. */
export async function listPatientSociallySavvyAssessments(
  supabase: Supa,
  patientId: string,
): Promise<SociallySavvyAssessmentRow[]> {
  const { data } = await supabase
    .from("socially_savvy_assessments")
    .select(SELECT_COLUMNS)
    .eq("patient_id", patientId)
    .order("round", { ascending: true });
  return (data ?? []).map(mapRow);
}

export async function getSociallySavvyAssessment(
  supabase: Supa,
  id: string,
): Promise<SociallySavvyAssessmentRow | null> {
  const { data } = await supabase.from("socially_savvy_assessments").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
  return data ? mapRow(data) : null;
}

/** Última aplicação concluída — a que vale para o PEI vigente. */
export async function getLatestConcludedSociallySavvy(
  supabase: Supa,
  patientId: string,
): Promise<SociallySavvyAssessmentRow | null> {
  const { data } = await supabase
    .from("socially_savvy_assessments")
    .select(SELECT_COLUMNS)
    .eq("patient_id", patientId)
    .eq("status", "concluida")
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRow(data) : null;
}
