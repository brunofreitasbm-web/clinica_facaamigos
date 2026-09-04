"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

type GoalInput = {
  discipline?: string;
  domain?: string;
  description?: string;
  baseline?: string;
  target?: string;
  criterion?: string;
};

type DisciplineMixInput = Record<string, { sessoesSemana?: number }>;

export async function createTreatmentPlan(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!patientId) {
    return { success: false, error: "Selecione um paciente." };
  }

  const reviewDueAt = String(formData.get("review_due_at") ?? "").trim();

  let disciplineMix: DisciplineMixInput;
  let goalsInput: GoalInput[];
  try {
    disciplineMix = JSON.parse(String(formData.get("discipline_mix") ?? "{}"));
    goalsInput = JSON.parse(String(formData.get("goals") ?? "[]"));
  } catch {
    return { success: false, error: "Dados do formulário inválidos. Recarregue a página e tente de novo." };
  }

  const disciplineEntries = Object.entries(disciplineMix);
  if (disciplineEntries.length === 0) {
    return { success: false, error: "Selecione ao menos uma disciplina do plano." };
  }
  if (disciplineEntries.some(([, v]) => !v || !Number.isInteger(v.sessoesSemana) || v.sessoesSemana! < 1)) {
    return { success: false, error: "Cada disciplina selecionada precisa de sessões/semana (número inteiro, mínimo 1)." };
  }

  const goals = goalsInput
    .map((g) => ({
      discipline: (g.discipline ?? "").trim(),
      domain: (g.domain ?? "").trim(),
      description: (g.description ?? "").trim(),
      baseline: (g.baseline ?? "").trim() || null,
      target: (g.target ?? "").trim() || null,
      criterion: (g.criterion ?? "").trim() || null,
    }))
    .filter((g) => g.discipline || g.domain || g.description);

  if (goals.length === 0) {
    return { success: false, error: "Adicione ao menos uma meta." };
  }
  if (goals.some((g) => !g.discipline || !g.domain || !g.description)) {
    return { success: false, error: "Toda meta precisa de disciplina, domínio e descrição." };
  }

  const supabase = await createClient();

  const { data: patient, error: patientLookupError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .maybeSingle();

  if (patientLookupError || !patient) {
    return { success: false, error: "Paciente não encontrado." };
  }

  // version é sequencial por paciente (não o default de coluna, que é
  // sempre 1) — precisa buscar o maior version já existente e somar 1.
  const { data: lastPlan } = await supabase
    .from("treatment_plans")
    .select("version")
    .eq("patient_id", patientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastPlan?.version ?? 0) + 1;

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .insert({
      patient_id: patientId,
      version: nextVersion,
      discipline_mix: disciplineMix,
      review_due_at: reviewDueAt || null,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return { success: false, error: "Não foi possível criar o plano terapêutico. Verifique se você tem permissão para este paciente e tente de novo." };
  }

  const { error: goalsError } = await supabase.from("plan_goals").insert(
    goals.map((g) => ({
      treatment_plan_id: plan.id,
      discipline: g.discipline,
      domain: g.domain,
      description: g.description,
      baseline: g.baseline,
      target: g.target,
      criterion: g.criterion,
    })),
  );

  if (goalsError) {
    return {
      success: false,
      error:
        "O plano foi criado em rascunho, mas houve erro ao salvar as metas. Abra o plano depois para completar as metas manualmente.",
    };
  }

  revalidatePath("/supervisao");
  return { success: true };
}
