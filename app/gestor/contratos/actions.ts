"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const PLAN_TYPES = ["particular", "reembolso_assistido", "coparticipacao"] as const;

/**
 * Cadastro de contrato particular/reembolso/co-participação. RLS
 * (patient_contracts_write) é o portão real, restrito a gestor.
 */
export async function createContract(formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const planType = String(formData.get("planType") ?? "");
  const monthlyFee = Number(formData.get("monthlyFee"));
  const paymentDay = Number(formData.get("paymentDay"));
  const startDate = String(formData.get("startDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!patientId) return { success: false, error: "Selecione um paciente." };
  if (!PLAN_TYPES.includes(planType as (typeof PLAN_TYPES)[number])) {
    return { success: false, error: "Selecione uma modalidade válida." };
  }
  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
    return { success: false, error: "Informe uma mensalidade válida." };
  }
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    return { success: false, error: "O dia de vencimento precisa ser entre 1 e 31." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("patient_contracts").insert({
    clinic_id: DEV_CLINIC_ID,
    patient_id: patientId,
    plan_type: planType,
    monthly_fee: monthlyFee,
    payment_day: paymentDay,
    start_date: startDate || undefined,
    notes: notes || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível criar o contrato — verifique se você tem permissão de gestor." };
  }

  revalidatePath("/gestor/contratos");
  return { success: true };
}

export async function updateContractStatus(contractId: string, status: "ativo" | "suspenso" | "cancelado" | "encerrado"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_contracts")
    .update({ status, end_date: status === "cancelado" || status === "encerrado" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", contractId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar o status do contrato." };
  }

  revalidatePath("/gestor/contratos");
  return { success: true };
}

/**
 * Gera a fatura do mês corrente para um contrato, evitando duplicar caso já
 * exista fatura pendente/paga para a mesma competência (mesmo mês/ano do
 * due_date). PIX/boleto ficam de fora — não há gateway de pagamento
 * integrado ainda; a fatura nasce "pendente" e é conciliada manualmente.
 */
export async function generateMonthlyInvoice(contractId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: contract, error: contractError } = await supabase
    .from("patient_contracts")
    .select("id, monthly_fee, payment_day, status")
    .eq("id", contractId)
    .single();

  if (contractError || !contract) {
    return { success: false, error: "Contrato não encontrado." };
  }
  if (contract.status !== "ativo") {
    return { success: false, error: "Só é possível gerar fatura para contratos ativos." };
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("contract_invoices")
    .select("id")
    .eq("contract_id", contractId)
    .gte("due_date", monthStart)
    .lt("due_date", nextMonthStart)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "A fatura deste mês já foi gerada para este contrato." };
  }

  const paymentDay = Math.min(contract.payment_day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(paymentDay).padStart(2, "0")}`;

  const { error } = await supabase.from("contract_invoices").insert({
    contract_id: contractId,
    due_date: dueDate,
    amount: contract.monthly_fee,
    status: "pendente",
  });

  if (error) {
    return { success: false, error: "Não foi possível gerar a fatura." };
  }

  revalidatePath("/gestor/contratos");
  return { success: true };
}

export async function markInvoicePaid(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contract_invoices")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (error) {
    return { success: false, error: "Não foi possível marcar a fatura como paga." };
  }

  revalidatePath("/gestor/contratos");
  return { success: true };
}
