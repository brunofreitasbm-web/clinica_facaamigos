"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true };
}
