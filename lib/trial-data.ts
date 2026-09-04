import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Valores aceitos pela CHECK constraint `trial_data_result_check`. */
export const TRIAL_RESULTS = ["correto", "incorreto", "ajuda", "nao_aplicado"] as const;
export type TrialResult = (typeof TRIAL_RESULTS)[number];

export type ProgramTrial = {
  trialIndex: number;
  result: TrialResult;
};

export type ProgramForCollection = {
  id: string;
  name: string;
  domain: string;
  targetType: string;
  masteryCriterion: string | null;
  /** Tentativas já registradas nesta sessão (`appointment_id`), em ordem. */
  trials: ProgramTrial[];
};

/**
 * Programas elegíveis pra coleta de tentativas na sessão: só os vinculados a
 * metas (`plan_goals`) de um plano de tratamento com `status = 'aprovado'` —
 * plano em rascunho/encerrado não tem coleta ativa. Retorna lista vazia
 * (não erro) quando o paciente não tem plano aprovado.
 */
export async function getProgramsForAppointment(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  patientId: string,
): Promise<ProgramForCollection[]> {
  const { data: plans } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "aprovado");

  const planIds = (plans ?? []).map((plan) => plan.id);
  if (planIds.length === 0) return [];

  const { data: goals } = await supabase
    .from("plan_goals")
    .select("id, domain, programs(id, name, target_type, mastery_criterion)")
    .in("treatment_plan_id", planIds);

  type GoalWithPrograms = {
    id: string;
    domain: string;
    programs: {
      id: string;
      name: string;
      target_type: string;
      mastery_criterion: string | null;
    }[];
  };

  const programs = ((goals ?? []) as GoalWithPrograms[]).flatMap((goal) =>
    goal.programs.map((program) => ({
      id: program.id,
      name: program.name,
      domain: goal.domain,
      targetType: program.target_type,
      masteryCriterion: program.mastery_criterion,
    })),
  );

  if (programs.length === 0) return [];

  const { data: trials } = await supabase
    .from("trial_data")
    .select("program_id, trial_index, result")
    .eq("appointment_id", appointmentId)
    .order("trial_index", { ascending: true });

  const trialsByProgram = new Map<string, ProgramTrial[]>();
  for (const trial of trials ?? []) {
    const list = trialsByProgram.get(trial.program_id) ?? [];
    list.push({ trialIndex: trial.trial_index, result: trial.result as TrialResult });
    trialsByProgram.set(trial.program_id, list);
  }

  return programs.map((program) => ({
    ...program,
    trials: trialsByProgram.get(program.id) ?? [],
  }));
}
