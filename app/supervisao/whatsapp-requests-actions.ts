// app/supervisao/whatsapp-requests-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyGuardianSlots, notifyRejection } from "@/lib/whatsapp/notify";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Aprova o pedido: cria a `authorization` (guia) a partir do formulário —
 * pré-preenchido no client com o que o LLM extraiu do PDF (`llm_check`), o
 * supervisor só confere/ajusta — mesmo shape de `registerAuthorization`
 * (app/recepcao/pacientes/[id]/stage-actions.ts), sem digitar nada que o
 * responsável já informou pelo WhatsApp.
 */
export async function approveEvaluationRequest(requestId: string, formData: FormData): Promise<ActionResult> {
  const guideNumber = String(formData.get("guide_number") ?? "").trim();
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const sessionsAuthorized = Number(formData.get("sessions_authorized") ?? 0);
  const validFrom = String(formData.get("valid_from") ?? "");
  const validTo = String(formData.get("valid_to") ?? "");

  if (!procedureCode || !sessionsAuthorized || !validFrom || !validTo) {
    return { success: false, error: "Preencha procedimento, sessões autorizadas e vigência da guia." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: request } = await admin
    .from("evaluation_requests")
    .select("id, patient_id, guia_document_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Pedido não encontrado." };
  if (request.status !== "pendente") return { success: false, error: "Este pedido já foi decidido." };

  const { data: patientInsurance } = await admin
    .from("patient_insurance")
    .select("id")
    .eq("patient_id", request.patient_id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!patientInsurance) {
    return { success: false, error: "Convênio do paciente não encontrado — verifique o cadastro." };
  }

  const { error: authError } = await admin.from("authorizations").insert({
    patient_insurance_id: patientInsurance.id,
    guide_number: guideNumber || null,
    procedure_code: procedureCode,
    sessions_authorized: sessionsAuthorized,
    valid_from: validFrom,
    valid_to: validTo,
    status: "ativa",
    document_id: request.guia_document_id,
  });

  if (authError) {
    return { success: false, error: "Não foi possível registrar a guia." };
  }

  const { error: updateError } = await admin
    .from("evaluation_requests")
    .update({ status: "aprovada", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: "Guia registrada, mas houve erro ao marcar o pedido como aprovado." };
  }

  await notifyGuardianSlots(requestId);

  revalidatePath("/supervisao");
  return { success: true };
}

export async function rejectEvaluationRequest(requestId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) {
    return { success: false, error: "Descreva o motivo da rejeição." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { error } = await admin
    .from("evaluation_requests")
    .update({
      status: "rejeitada",
      rejection_reason: reason.trim(),
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pendente");

  if (error) {
    return { success: false, error: "Não foi possível rejeitar o pedido." };
  }

  await notifyRejection(requestId, reason.trim());

  revalidatePath("/supervisao");
  return { success: true };
}
