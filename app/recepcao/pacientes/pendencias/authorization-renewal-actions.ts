// app/recepcao/pacientes/pendencias/authorization-renewal-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Marca uma solicitação de renovação (aberta automaticamente por
 * refresh_authorization_renewal_requests, supabase/migrations/20260906000017_
 * authorization_renewal_requests.sql) como resolvida — a recepção usa isso
 * depois de já ter cadastrado a nova guia na AutorizacaoWizard. Só sai da
 * fila de pendências quando a família de fato tem a guia nova, não quando
 * alguém "silencia" o alerta.
 */
export async function resolveAuthorizationRenewalRequest(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request } = await supabase
    .from("authorization_renewal_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: "Solicitação não encontrada." };
  }
  if (request.status !== "pendente" && request.status !== "solicitada_convenio") {
    return { success: false, error: "Essa solicitação já foi resolvida." };
  }

  const { error } = await supabase
    .from("authorization_renewal_requests")
    .update({
      status: "recebida",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    return { success: false, error: "Não foi possível marcar como resolvida. Tente de novo." };
  }

  revalidatePath("/recepcao");
  revalidatePath("/recepcao/pacientes/pendencias");
  return { success: true };
}
