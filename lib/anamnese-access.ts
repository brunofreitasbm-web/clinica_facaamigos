import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

/**
 * Quem pode conduzir a 1ª avaliação (anamnese ampliada).
 *
 * Até aqui a tela só existia dentro de `/supervisao`, e o guard de papel
 * (lib/supabase/middleware.ts + ROLE_ALLOWED_PREFIXES) devolvia qualquer
 * terapeuta pra `/terapeuta` — na prática só supervisão/gestão conseguia
 * registrar a 1ª avaliação, mesmo com a RLS de `anamneses` já liberando
 * 'terapeuta' desde 20260906000001_intake_journey.sql e mesmo com o
 * calendário de 1ª avaliação (app/supervisao/evaluation-calendar.tsx)
 * agendando a avaliação NO NOME de um terapeuta avaliador.
 *
 * Regra: gestor e supervisor sempre podem. Terapeuta pode quando é
 * avaliador (`profiles.is_evaluator`, 20260907220000_evaluator_therapist_flag.sql)
 * ou quando é o terapeuta da própria consulta de avaliação já agendada para
 * este paciente — quem foi escalado pra conduzir consegue registrar, mesmo
 * que a flag ainda não tenha sido marcada pelo gestor.
 */
export async function canConductFirstAssessment(
  supabase: Supa,
  userId: string,
  patientId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_evaluator")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return false;
  if (profile.role === "gestor" || profile.role === "supervisor") return true;
  if (profile.role !== "terapeuta") return false;
  if (profile.is_evaluator) return true;

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("therapist_id", userId)
    .eq("is_evaluation", true);

  return (count ?? 0) > 0;
}
