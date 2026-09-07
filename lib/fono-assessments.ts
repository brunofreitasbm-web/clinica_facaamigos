import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { FonoInstrument } from "@/lib/fono-instruments";

type Supa = SupabaseClient<Database>;

export type FonoAssessmentRow = {
  id: string;
  instrument: FonoInstrument;
  status: "rascunho" | "concluida";
  testDate: string;
  birthDate: string;
  ageYears: number;
  ageMonths: number;
  assessedById: string;
  assessedByName: string;
  responses: Record<string, string>;
  manualScores: Record<string, number | null>;
  results: Record<string, unknown>;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  instrument: string;
  status: string;
  test_date: string;
  birth_date: string;
  age_years: number;
  age_months: number;
  assessed_by: string;
  responses: unknown;
  manual_scores: unknown;
  results: unknown;
  observations: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
}): FonoAssessmentRow {
  const assessor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    instrument: row.instrument as FonoInstrument,
    status: row.status as "rascunho" | "concluida",
    testDate: row.test_date,
    birthDate: row.birth_date,
    ageYears: row.age_years,
    ageMonths: row.age_months,
    assessedById: row.assessed_by,
    assessedByName: assessor?.full_name ?? "—",
    responses: (row.responses as Record<string, string>) ?? {},
    manualScores: (row.manual_scores as Record<string, number | null>) ?? {},
    results: (row.results as Record<string, unknown>) ?? {},
    observations: row.observations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, instrument, status, test_date, birth_date, age_years, age_months, assessed_by, responses, manual_scores, results, observations, created_at, updated_at, profiles!assessed_by(full_name)";

/** Histórico completo do paciente, mais recentes primeiro, para o hub `/terapeuta/paciente/[id]/fono`. */
export async function listPatientFonoAssessments(supabase: Supa, patientId: string): Promise<FonoAssessmentRow[]> {
  const { data } = await supabase
    .from("fono_assessments")
    .select(SELECT_COLUMNS)
    .eq("patient_id", patientId)
    .order("test_date", { ascending: false });
  return (data ?? []).map(mapRow);
}

export async function getFonoAssessment(supabase: Supa, id: string): Promise<FonoAssessmentRow | null> {
  const { data } = await supabase.from("fono_assessments").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
  return data ? mapRow(data) : null;
}

/** Última avaliação concluída de cada instrumento — usada em lib/plan-suggestions.ts. */
export async function getLatestConcludedByInstrument(
  supabase: Supa,
  patientId: string,
): Promise<Partial<Record<FonoInstrument, FonoAssessmentRow>>> {
  const { data } = await supabase
    .from("fono_assessments")
    .select(SELECT_COLUMNS)
    .eq("patient_id", patientId)
    .eq("status", "concluida")
    .order("test_date", { ascending: true });

  const latest: Partial<Record<FonoInstrument, FonoAssessmentRow>> = {};
  for (const row of (data ?? []).map(mapRow)) {
    latest[row.instrument] = row; // última sobrescreve, pois a lista vem em ordem crescente de data
  }
  return latest;
}
