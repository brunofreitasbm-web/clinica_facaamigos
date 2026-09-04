"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

/** Devolve uma meta individual: vira `suspensa` (ver mapeamento acima). */
export async function returnGoal(planId: string, goalId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase
    .from("plan_goals")
    .update({ status: RETURNED_GOAL_STATUS, validated_by: user.id })
    .eq("id", goalId)
    .eq("treatment_plan_id", planId);

  if (error) return { success: false, error: "Não foi possível devolver a meta." };

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * "Devolver com notas" do mock (botão no nível do plano, não da meta): o
 * schema não tem coluna de observação/nota em `treatment_plans` nem em
 * `plan_goals` (PRD §7) — qualquer texto digitado aqui não tem onde ser
 * persistido, então a ação de fato só devolve em lote todas as metas ainda
 * `ativa` do plano (equivalente a clicar "Devolver" em cada uma). O
 * parâmetro `notes` é aceito e ignorado de propósito; ver comentário no
 * formulário (`planos-panel.tsx`) que explica isso ao usuário.
 */
export async function returnAllPendingGoals(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase
    .from("plan_goals")
    .update({ status: RETURNED_GOAL_STATUS, validated_by: user.id })
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
