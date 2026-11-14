"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DISCIPLINES } from "./planos/novo/disciplines";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Mapeamento de status usado nas ações abaixo — `plan_goals.status` só tem
 * `ativa|atingida|suspensa` (PRD §7); não existe "devolvido" no schema. Uma
 * meta "devolvida" pelo coordenador (pedido de revisão ao terapeuta) vira
 * `suspensa` com `validated_by` preenchido — a mesma coluna que uma meta
 * suspensa por outro motivo clínico usaria. Isso é uma simplificação
 * deliberada: o schema não distingue "suspensa porque devolvida na
 * aprovação" de "suspensa porque o paciente não trabalha mais esse
 * domínio". Ver também PLAN_GOAL_STATUS_STYLE em lib/appointment-status-style.ts.
 */
const RETURNED_GOAL_STATUS = "suspensa";
// "Validar" nesta tela (aprovação do PLANO pela coordenação) não é o mesmo
// evento clínico que "o paciente atingiu a meta" meses depois de terapia —
// mas o schema só tem um enum de 3 valores pra `plan_goals.status`, e a
// tarefa que gerou esta implementação define explicitamente esse
// mapeamento: meta validada na aprovação usa o mesmo status `atingida` que
// o resto do sistema (ex.: components/prontuario/patient-tabs.tsx) usa pra
// "meta alcançada". Aceito como a leitura pretendida do PRD; documentado
// aqui para quem for mexer depois.
const VALIDATED_GOAL_STATUS = "atingida";

/** Valida uma meta individual: fica `atingida`, com quem validou e quando. */
export async function validateGoal(planId: string, goalId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase
    .from("plan_goals")
    .update({ status: VALIDATED_GOAL_STATUS, achieved_at: new Date().toISOString(), validated_by: user.id })
    .eq("id", goalId)
    .eq("treatment_plan_id", planId);

  if (error) return { success: false, error: "Não foi possível validar a meta." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Devolve uma meta individual: vira `suspensa` (ver mapeamento acima).
 * `notes` grava em `plan_goals.supervisor_notes` (migration
 * 20260906000003_pdi_completo.sql) — antes não existia coluna pra isso e a
 * observação do supervisor era descartada silenciosamente.
 */
export async function returnGoal(planId: string, goalId: string, notes?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase
    .from("plan_goals")
    .update({ status: RETURNED_GOAL_STATUS, validated_by: user.id, supervisor_notes: notes?.trim() || null })
    .eq("id", goalId)
    .eq("treatment_plan_id", planId);

  if (error) return { success: false, error: "Não foi possível devolver a meta." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * "Devolver com notas" (botão no nível do plano): devolve em lote todas as
 * metas ainda `ativa` do plano, gravando a mesma observação em
 * `supervisor_notes` de cada uma — desde a migration 20260906000003 o schema
 * tem onde persistir esse texto (antes era descartado, ver git history).
 */
export async function returnAllPendingGoals(planId: string, notes?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase
    .from("plan_goals")
    .update({ status: RETURNED_GOAL_STATUS, validated_by: user.id, supervisor_notes: notes?.trim() || null })
    .eq("treatment_plan_id", planId)
    .eq("status", "ativa");

  if (error) return { success: false, error: "Não foi possível devolver as metas pendentes." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Aprova o plano — regra de negócio adotada (não estava no PRD): só permite
 * aprovar quando NENHUMA meta segue `ativa` (todas foram validadas como
 * `atingida` ou devolvidas como `suspensa`). A UI (`planos-panel.tsx`) já
 * desabilita o botão nesse caso, mas a Server Action recheca no banco —
 * nunca confia só no estado do cliente.
 */
export async function approvePlan(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { count: pendingCount } = await supabase
    .from("plan_goals")
    .select("id", { count: "exact", head: true })
    .eq("treatment_plan_id", planId)
    .eq("status", "ativa");

  if ((pendingCount ?? 0) > 0) {
    return { success: false, error: "Ainda há metas pendentes — valide ou devolva todas antes de aprovar." };
  }

  const { error } = await supabase
    .from("treatment_plans")
    .update({ status: "aprovado", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("status", "rascunho");

  if (error) return { success: false, error: "Não foi possível aprovar o plano." };

  revalidatePath("/supervisao");
  return { success: true };
}

const HORIZONS = ["curto", "medio", "longo"] as const;
const METHODOLOGIES = ["dtt", "naturalistico", "misto", "outra"] as const;

export type PlanContentInput = {
  generalObjective: string;
  familyPriorities: string;
};

const GOAL_STATUSES = ["ativa", "atingida", "suspensa"] as const;

export type PlanGoalEditInput = {
  discipline: string;
  description: string;
  domain: string;
  criterion: string;
  horizon: string;
  strategy: string;
  methodology: string;
  status: string;
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Edita o conteúdo do PTS (objetivo geral e prioridades da família). Vale para
 * rascunho e para PTS vigente: a supervisão pode corrigir o plano depois de
 * publicado. Não altera `status`, `version` nem metas — isso segue nas ações
 * próprias. RLS (`treatment_plans_approve_supervisor`) limita a supervisor/gestor.
 */
export async function updatePlanContent(planId: string, input: PlanContentInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  // Decisão: editar um PTS já `aprovado` é in-place. Não cria nova versão
  // (version/status/previous_plan_id ficam como estão); o histórico entregue à
  // família fica registrado pela auditoria de `treatment_plans`/`plan_goals`.

  const { error } = await supabase
    .from("treatment_plans")
    .update({
      general_objective: optionalText(input.generalObjective),
      family_priorities: optionalText(input.familyPriorities),
    })
    .eq("id", planId);

  if (error) return { success: false, error: "Não foi possível salvar o objetivo geral do PTS." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Edita uma meta do PTS. Disciplina e status não são editáveis aqui: a
 * disciplina define o programa/agenda e o status segue o fluxo de
 * validação/devolução. `domain` é obrigatório (mesma regra da criação).
 */
export async function updatePlanGoal(
  planId: string,
  goalId: string,
  input: PlanGoalEditInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const discipline = input.discipline.trim();
  const description = input.description.trim();
  const domain = input.domain.trim();
  if (!discipline || !description || !domain) {
    return { success: false, error: "Toda meta precisa de disciplina, domínio e descrição." };
  }
  if (!DISCIPLINES.some((d) => d.value === discipline)) {
    return { success: false, error: "Disciplina da meta inválida." };
  }
  if (!(GOAL_STATUSES as readonly string[]).includes(input.status)) {
    return { success: false, error: "Status da meta inválido." };
  }
  if (input.horizon && !(HORIZONS as readonly string[]).includes(input.horizon)) {
    return { success: false, error: "Prazo da meta inválido." };
  }
  if (input.methodology && !(METHODOLOGIES as readonly string[]).includes(input.methodology)) {
    return { success: false, error: "Metodologia da meta inválida." };
  }

  // Status editado direto aqui não passa pelo fluxo de validação/devolução;
  // por isso registramos quem mexeu (validated_by) e quando a meta foi atingida,
  // do mesmo jeito que validateGoal/returnGoal já fazem. O vínculo com o
  // catálogo de domínios fica em `programs`, não em `plan_goals`.
  const { data: current, error: readError } = await supabase
    .from("plan_goals")
    .select("status")
    .eq("id", goalId)
    .eq("treatment_plan_id", planId)
    .single();
  if (readError || !current) return { success: false, error: "Meta não encontrada neste PTS." };

  const statusFields =
    input.status !== current.status
      ? {
          status: input.status,
          validated_by: input.status === "ativa" ? null : user.id,
          achieved_at: input.status === "atingida" ? new Date().toISOString() : null,
        }
      : {};

  const { error } = await supabase
    .from("plan_goals")
    .update({
      discipline,
      description,
      domain,
      criterion: optionalText(input.criterion),
      horizon: input.horizon || null,
      strategy: optionalText(input.strategy),
      methodology: input.methodology || null,
      ...statusFields,
    })
    .eq("id", goalId)
    .eq("treatment_plan_id", planId);

  if (error) return { success: false, error: "Não foi possível salvar a meta." };

  revalidatePath("/supervisao");
  return { success: true };
}
