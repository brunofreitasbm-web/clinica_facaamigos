"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Conclui um pedido de remarcação da família (PRD §3.4) — a RLS
 * (reschedule_requests_update_staff, 20260906000019) é o portão real, aqui
 * só marca status/resolved_by/resolved_at. A remarcação de fato (mudar
 * horário do appointment) continua sendo feita na agenda normal, como
 * qualquer outra sessão.
 */
export async function resolveRescheduleRequest(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { error } = await supabase
    .from("reschedule_requests")
    .update({ status: "concluida", resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    return { success: false, error: "Não foi possível concluir o pedido." };
  }

  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true };
}

/**
 * Marca um documento enviado pela família (category='familia_envio', PRD
 * §3.6) como revisado — documents_update (20260904000014) é o portão real.
 * Não altera shared_with_family: se a recepção quiser liberar o documento
 * de volta pro portal, isso é feito na tela normal do prontuário do
 * paciente, não aqui.
 */
export async function reviewFamilyDocument(documentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { error } = await supabase
    .from("documents")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", documentId);

  if (error) {
    return { success: false, error: "Não foi possível marcar como revisado." };
  }

  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Reatribuição manual de um item da fila de pendências (§9.1 "dono + prazo").
 * `itemId` é o mesmo `PendingQueueItem.id` usado como `item_id` em
 * `pending_queue_assignments` (ver attachQueueAssignments em
 * lib/reception-queue.ts) — a linha já existe nesse ponto porque a página só
 * mostra o seletor depois que a fila (que cria o assignment se faltar) já
 * carregou.
 */
export async function reassignQueueItem(itemId: string, assigneeId: string): Promise<ActionResult> {
  if (!assigneeId) {
    return { success: false, error: "Selecione um responsável." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pending_queue_assignments")
    .update({ assigned_to: assigneeId })
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("item_id", itemId);

  if (error) {
    return { success: false, error: "Não foi possível reatribuir. Tente de novo." };
  }

  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true };
}

/**
 * Coloca o item para o último lugar da fila (§9.1).
 * Útil quando o operador julga que não é relevante autorizar ou tratar o item no momento.
 * Atualiza `due_at` para uma data futura além do maior `due_at` existente na clínica
 * (colocando-o no final da faixa "Depois") e remove `escalated_at` para tirá-lo de "Agora".
 */
export async function moveQueueItemToEnd(itemId: string): Promise<ActionResult> {
  if (!itemId) {
    return { success: false, error: "Item inválido." };
  }

  const supabase = await createClient();

  // Busca o maior due_at atual entre as pendências da clínica
  const { data: latest } = await supabase
    .from("pending_queue_assignments")
    .select("due_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("due_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const minFutureMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const latestMs = latest?.due_at ? new Date(latest.due_at).getTime() : 0;
  const newDueAt = new Date(Math.max(minFutureMs, latestMs + 60_000)).toISOString();

  const { data: existing } = await supabase
    .from("pending_queue_assignments")
    .select("id")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("item_id", itemId)
    .maybeSingle();

  let updateError = null;

  if (existing) {
    const { error } = await supabase
      .from("pending_queue_assignments")
      .update({
        due_at: newDueAt,
        escalated_at: null,
      })
      .eq("id", existing.id);
    updateError = error;
  } else {
    const category = itemId.startsWith("cadastro-ia-")
      ? "cadastro_assistido_ia"
      : itemId.startsWith("guia-vence-")
      ? "guia_vencendo"
      : itemId.startsWith("falta-auto-")
      ? "falta_sem_motivo"
      : itemId.startsWith("remarcacao-")
      ? "remarcacao_solicitada"
      : itemId.startsWith("renovacao-")
      ? "renovacao_solicitada"
      : "cadastro_incompleto";

    const { error } = await supabase
      .from("pending_queue_assignments")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        item_id: itemId,
        category,
        due_at: newDueAt,
        escalated_at: null,
      });
    updateError = error;
  }

  if (updateError) {
    return { success: false, error: "Não foi possível mover para o fim da fila." };
  }

  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true };
}

/**
 * Restaura o item para o topo da fila (define due_at para agora).
 */
export async function restoreQueueItemToTop(itemId: string): Promise<ActionResult> {
  if (!itemId) return { success: false, error: "Item inválido." };
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("pending_queue_assignments")
    .update({
      due_at: now,
      escalated_at: null,
    })
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("item_id", itemId);

  if (error) return { success: false, error: "Não foi possível priorizar o item." };

  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true };
}

