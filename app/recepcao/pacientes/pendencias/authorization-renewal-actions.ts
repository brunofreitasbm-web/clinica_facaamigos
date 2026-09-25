// app/recepcao/pacientes/pendencias/authorization-renewal-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateRenewalPeriod, type RenewalPeriodInput } from "./authorization-renewal-pure";

type ActionResult = { success: true } | { success: false; error: string };

function revalidateQueue() {
  revalidatePath("/recepcao");
  revalidatePath("/recepcao/pacientes/pendencias");
}

/**
 * Erro do banco em texto para a recepção. A trava de reavaliação
 * (fn_check_reassessment_lock, supabase/migrations/20260904000027_) já vem
 * com uma mensagem pensada para o usuário; o resto vira mensagem genérica.
 */
function dbErrorMessage(error: { message?: string } | null, fallback: string): string {
  if (error?.message?.startsWith("Bloqueio de Autorização")) return error.message;
  return fallback;
}

/**
 * Pede a renovação de uma guia ao plano: grava a guia nova em `authorizations`
 * com status "pendente", requested_at e previous_authorization_id apontando
 * para a guia atual (é assim que o schema representa "renovação pedida,
 * aguardando o plano"). Se a rotina diária já tinha aberto um alerta em
 * authorization_renewal_requests para essa guia, ele passa para
 * "solicitada_convenio" — continua na fila até o plano responder.
 *
 * Não mexe no saldo da guia atual: as sessões novas só valem quando o plano
 * autorizar (registerAuthorizationRenewalResponse).
 */
export async function requestAuthorizationRenewal(
  authorizationId: string,
  input: RenewalPeriodInput,
): Promise<ActionResult> {
  const invalid = validateRenewalPeriod(input);
  if (invalid) return { success: false, error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login novamente." };

  const { data: current } = await supabase
    .from("authorizations")
    .select("id, patient_insurance_id, procedure_code, status")
    .eq("id", authorizationId)
    .maybeSingle();
  if (!current) return { success: false, error: "Guia não encontrada." };
  if (current.status !== "ativa") return { success: false, error: "Só dá para renovar uma guia ativa." };

  const { data: existing } = await supabase
    .from("authorizations")
    .select("id")
    .eq("previous_authorization_id", authorizationId)
    .in("status", ["pendente", "ativa"])
    .limit(1);
  if (existing && existing.length > 0) {
    return { success: false, error: "Essa guia já tem uma renovação pedida ou registrada." };
  }

  const { error } = await supabase.from("authorizations").insert({
    patient_insurance_id: current.patient_insurance_id,
    procedure_code: current.procedure_code,
    sessions_authorized: input.sessions,
    valid_from: input.validFrom,
    valid_to: input.validTo,
    status: "pendente",
    requested_at: new Date().toISOString(),
    previous_authorization_id: authorizationId,
  });
  if (error) {
    return { success: false, error: dbErrorMessage(error, "Não foi possível registrar o pedido de renovação. Tente de novo.") };
  }

  await supabase
    .from("authorization_renewal_requests")
    .update({ status: "solicitada_convenio" })
    .eq("authorization_id", authorizationId)
    .eq("status", "pendente");

  revalidateQueue();
  return { success: true };
}

export type RenewalResponseInput =
  | ({ outcome: "autorizada"; guideNumber: string } & RenewalPeriodInput)
  | { outcome: "negada" };

/**
 * Registra a resposta do plano a uma renovação pedida:
 *   autorizada → a guia pendente vira "ativa" com número, sessões e vigência
 *                que o plano aprovou, e o alerta de renovação da guia anterior
 *                é fechado ("recebida");
 *   negada     → a guia pendente vira "negada"; o alerta continua aberto,
 *                porque o paciente segue sem guia nova.
 */
export async function registerAuthorizationRenewalResponse(
  pendingAuthorizationId: string,
  input: RenewalResponseInput,
): Promise<ActionResult> {
  if (input.outcome === "autorizada") {
    if (!input.guideNumber.trim()) return { success: false, error: "Informe o número da guia autorizada." };
    const invalid = validateRenewalPeriod(input);
    if (invalid) return { success: false, error: invalid };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login novamente." };

  const { data: pending } = await supabase
    .from("authorizations")
    .select("id, status, previous_authorization_id")
    .eq("id", pendingAuthorizationId)
    .maybeSingle();
  if (!pending || !pending.previous_authorization_id) return { success: false, error: "Pedido de renovação não encontrado." };
  if (pending.status !== "pendente") return { success: false, error: "Esse pedido de renovação já foi respondido." };

  if (input.outcome === "negada") {
    const { error } = await supabase.from("authorizations").update({ status: "negada" }).eq("id", pendingAuthorizationId);
    if (error) return { success: false, error: "Não foi possível registrar a negativa. Tente de novo." };
    revalidateQueue();
    return { success: true };
  }

  const { error } = await supabase
    .from("authorizations")
    .update({
      status: "ativa",
      guide_number: input.guideNumber.trim(),
      sessions_authorized: input.sessions,
      valid_from: input.validFrom,
      valid_to: input.validTo,
      approved_at: new Date().toISOString(),
    })
    .eq("id", pendingAuthorizationId);
  if (error) return { success: false, error: "Não foi possível registrar a guia autorizada. Tente de novo." };

  await supabase
    .from("authorization_renewal_requests")
    .update({ status: "recebida", resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("authorization_id", pending.previous_authorization_id)
    .in("status", ["pendente", "solicitada_convenio"]);

  revalidateQueue();
  return { success: true };
}

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

  revalidateQueue();
  return { success: true };
}
