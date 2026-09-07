"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

type ProgramInput = {
  name?: string;
  targetType?: string;
  masteryCriterion?: string | null;
  protocolItemId?: string | null;
};

type GoalInput = {
  discipline?: string;
  domain?: string;
  description?: string;
  baseline?: string;
  target?: string;
  criterion?: string;
  horizon?: string;
  strategy?: string;
  methodology?: string;
  programs?: ProgramInput[];
};

const PROGRAM_TARGET_TYPES = ["tentativa", "duracao", "frequencia", "tarefa"] as const;

type DisciplineMixInput = Record<string, { sessoesSemana?: number }>;

export async function createTreatmentPlan(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!patientId) {
    return { success: false, error: "Selecione um paciente." };
  }

  const reviewDueAt = String(formData.get("review_due_at") ?? "").trim();
  const generalObjective = String(formData.get("general_objective") ?? "").trim();
  const familyPriorities = String(formData.get("family_priorities") ?? "").trim();

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
      horizon: (g.horizon ?? "").trim() || null,
      strategy: (g.strategy ?? "").trim() || null,
      methodology: (g.methodology ?? "").trim() || null,
      // Programas ABA (coleta por tentativa, tabela `programs`) anexados a
      // esta meta — só relevante pra discipline='aba'. Ver
      // lib/plan-suggestions.ts e o CHECK de `programs` (exatamente um entre
      // domain_taxonomy_id/protocol_item_id).
      programs: (g.programs ?? [])
        .map((p) => ({
          name: (p.name ?? "").trim(),
          targetType: PROGRAM_TARGET_TYPES.includes(p.targetType as (typeof PROGRAM_TARGET_TYPES)[number])
            ? (p.targetType as (typeof PROGRAM_TARGET_TYPES)[number])
            : "tentativa",
          masteryCriterion: (p.masteryCriterion ?? "").trim() || null,
          protocolItemId: p.protocolItemId ?? null,
        }))
        .filter((p) => p.name),
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
    .select("id, clinic_id")
    .eq("id", patientId)
    .maybeSingle();

  if (patientLookupError || !patient) {
    return { success: false, error: "Paciente não encontrado." };
  }

  // version é sequencial por paciente (não o default de coluna, que é
  // sempre 1) — precisa buscar o maior version já existente e somar 1.
  // Também usado como previous_plan_id — dá pra seguir o histórico entre
  // versões, que antes só existia como um contador solto (PDI, slide 34:
  // "o PDI não termina quando é entregue").
  const { data: lastPlan } = await supabase
    .from("treatment_plans")
    .select("id, version")
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
      general_objective: generalObjective || null,
      family_priorities: familyPriorities || null,
      previous_plan_id: lastPlan?.id ?? null,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return { success: false, error: "Não foi possível criar o plano terapêutico. Verifique se você tem permissão para este paciente e tente de novo." };
  }

  // Insere meta a meta (em vez de bulk insert) porque cada meta de ABA com
  // programas anexados precisa do id da meta recém-criada de volta pra
  // gravar em `programs.plan_goal_id` — a ordem de retorno de um insert em
  // lote não é garantida pelo Postgres.
  const domainTaxonomyCache = new Map<string, string>();

  async function resolveDomainTaxonomyId(clinicId: string, discipline: string, domain: string): Promise<string | null> {
    const cacheKey = `${discipline}::${domain}`;
    const cached = domainTaxonomyCache.get(cacheKey);
    if (cached) return cached;

    const { data: existing } = await supabase
      .from("domain_taxonomy")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("discipline", discipline)
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      domainTaxonomyCache.set(cacheKey, existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("domain_taxonomy")
      .insert({ clinic_id: clinicId, discipline, domain })
      .select("id")
      .single();

    if (error || !created) return null;
    domainTaxonomyCache.set(cacheKey, created.id);
    return created.id;
  }

  let programsFailed = false;

  for (const g of goals) {
    const { data: createdGoal, error: goalError } = await supabase
      .from("plan_goals")
      .insert({
        treatment_plan_id: plan.id,
        discipline: g.discipline,
        domain: g.domain,
        description: g.description,
        baseline: g.baseline,
        target: g.target,
        criterion: g.criterion,
        horizon: g.horizon,
        strategy: g.strategy,
        methodology: g.methodology,
      })
      .select("id")
      .single();

    if (goalError || !createdGoal) {
      return {
        success: false,
        error:
          "O plano foi criado em rascunho, mas houve erro ao salvar as metas. Abra o plano depois para completar as metas manualmente.",
      };
    }

    for (const p of g.programs) {
      let domainTaxonomyId: string | null = null;
      if (!p.protocolItemId) {
        domainTaxonomyId = await resolveDomainTaxonomyId(patient.clinic_id, g.discipline, g.domain);
        if (!domainTaxonomyId) {
          programsFailed = true;
          continue;
        }
      }

      const { error: programError } = await supabase.from("programs").insert({
        plan_goal_id: createdGoal.id,
        protocol_item_id: p.protocolItemId,
        domain_taxonomy_id: p.protocolItemId ? null : domainTaxonomyId,
        name: p.name,
        target_type: p.targetType,
        mastery_criterion: p.masteryCriterion,
      });

      if (programError) programsFailed = true;
    }
  }

  revalidatePath("/supervisao");

  if (programsFailed) {
    return {
      success: false,
      error:
        "O plano e as metas foram salvos, mas houve erro ao salvar um ou mais programas ABA. Abra o plano depois para revisar a coleta de dados dessa meta.",
    };
  }

  return { success: true };
}
