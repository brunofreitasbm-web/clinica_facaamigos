// app/recepcao/pacientes/pendencias/authorization-renewal-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateRenewalPeriod, type RenewalPeriodInput } from "./authorization-renewal-pure";
import { buildRenewalApprovedMessage, buildWhatsappLink } from "@/lib/whatsapp-message";

/** `whatsappUrl`: aviso manual ao responsável (wa.me), só quando a guia nova foi autorizada. */
type ActionResult = { success: true; whatsappUrl?: string; note?: string } | { success: false; error: string };

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
  return { success: true, ...(await renewalWhatsappNotice(supabase, pendingAuthorizationId, input)) };
}

/**
 * Link do WhatsApp com o aviso da guia renovada. O envio é manual (a recepção
 * só aperta enviar), então qualquer falha aqui vira `note` — a guia já foi
 * gravada e não pode ser desfeita por causa do aviso.
 */
async function renewalWhatsappNotice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorizationId: string,
  input: { sessions: number; validTo: string },
): Promise<{ whatsappUrl?: string; note?: string }> {
  const noPhone = { note: "Guia registrada. Sem telefone do responsável — avise a família manualmente." };
  const { data: auth } = await supabase
    .from("authorizations")
    .select("patient_insurance(patient_id, insurers(name), patients(full_name))")
    .eq("id", authorizationId)
    .maybeSingle();
  const insurance = Array.isArray(auth?.patient_insurance) ? auth?.patient_insurance[0] : auth?.patient_insurance;
  if (!insurance?.patient_id) return noPhone;

  const { data: guardians } = await supabase
    .from("guardians")
    .select("full_name, phone, is_financial")
    .eq("patient_id", insurance.patient_id);
  const guardian = guardians?.find((g) => g.is_financial && g.phone) ?? guardians?.find((g) => g.phone);
  if (!guardian?.phone) return noPhone;

  const insurer = Array.isArray(insurance.insurers) ? insurance.insurers[0] : insurance.insurers;
  const patient = Array.isArray(insurance.patients) ? insurance.patients[0] : insurance.patients;
  const message = buildRenewalApprovedMessage({
    guardianName: guardian.full_name,
    patientName: patient?.full_name,
    insurerName: insurer?.name,
    sessions: input.sessions,
    validTo: input.validTo,
  });
  return { whatsappUrl: buildWhatsappLink(guardian.phone, message) };
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
