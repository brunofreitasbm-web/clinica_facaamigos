"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { computeMonthlyFee, nextInvoiceDueDate } from "@/lib/contract-billing";
import { generateReceiptForInvoice } from "@/lib/receipts";

type ActionResult = { success: true } | { success: false; error: string };

const PLAN_TYPES = ["particular", "reembolso_assistido", "coparticipacao"] as const;
const BILLING_MODES = ["pacote", "avulsa"] as const;
const PAID_METHODS = ["pix", "dinheiro", "cartao_credito", "cartao_debito", "boleto", "transferencia"] as const;

/**
 * Cadastro de contrato particular/reembolso/co-participação. RLS
 * (patient_contracts_write) é o portão real, restrito a gestor.
 *
 * Diretriz de Atendimento Particular (FASE 2): a forma preferencial de
 * cobrança é pacote mensal adiantado, calculado a partir do valor unitário
 * da especialidade (specialty_prices) × sessões/mês — nunca confia no
 * cálculo feito no cliente, recalcula aqui antes de gravar.
 */
export async function createContract(formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const planType = String(formData.get("planType") ?? "");
  const paymentDay = Number(formData.get("paymentDay"));
  const startDate = String(formData.get("startDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const billingMode = String(formData.get("billingMode") ?? "pacote");
  const specialtyValue = String(formData.get("specialtyValue") ?? "").trim();
  const unitPrice = Number(formData.get("unitPrice"));
  const sessionsPerMonthRaw = String(formData.get("sessionsPerMonth") ?? "").trim();
  const sessionsPerMonth = sessionsPerMonthRaw ? Number(sessionsPerMonthRaw) : null;
  const invoiceDayRaw = String(formData.get("invoiceDay") ?? "").trim();
  const invoiceDay = invoiceDayRaw ? Number(invoiceDayRaw) : 1;

  if (!patientId) return { success: false, error: "Selecione um paciente." };
  if (!PLAN_TYPES.includes(planType as (typeof PLAN_TYPES)[number])) {
    return { success: false, error: "Selecione uma modalidade válida." };
  }
  if (!BILLING_MODES.includes(billingMode as (typeof BILLING_MODES)[number])) {
    return { success: false, error: "Selecione uma forma de cobrança válida." };
  }
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    return { success: false, error: "O dia de vencimento precisa ser entre 1 e 31." };
  }
  if (!specialtyValue) {
    return { success: false, error: "Selecione a especialidade do atendimento." };
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { success: false, error: "Informe um valor unitário válido." };
  }
  if (!Number.isInteger(invoiceDay) || invoiceDay < 1 || invoiceDay > 28) {
    return { success: false, error: "O dia de faturamento precisa ser entre 1 e 28." };
  }

  let monthlyFee = 0;
  if (billingMode === "pacote") {
    if (!sessionsPerMonth || !Number.isInteger(sessionsPerMonth) || sessionsPerMonth < 1 || sessionsPerMonth > 60) {
      return { success: false, error: "Informe um número válido de sessões por mês (1 a 60)." };
    }
    // Recalcula no servidor — o valor mostrado no formulário é só uma prévia.
    monthlyFee = computeMonthlyFee(unitPrice, sessionsPerMonth);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("patient_contracts").insert({
    clinic_id: DEV_CLINIC_ID,
    patient_id: patientId,
    plan_type: planType,
    billing_mode: billingMode,
    specialty_value: specialtyValue,
    unit_price: unitPrice,
    sessions_per_month: billingMode === "pacote" ? sessionsPerMonth : null,
    monthly_fee: monthlyFee,
    payment_day: paymentDay,
    invoice_day: invoiceDay,
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
    .select("id, monthly_fee, payment_day, invoice_day, sessions_per_month, status")
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

  // Checagem em nível de aplicação (mensagem amigável) além do índice único
  // contract_invoices_month_uq (contract_id, reference_month) no banco, que
  // é o portão real contra corrida entre duas gerações simultâneas.
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

  const dueDate = nextInvoiceDueDate(now, contract.invoice_day ?? contract.payment_day, CLINIC_TIMEZONE)
    .toISOString()
    .slice(0, 10);
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const sessionsPerMonth = contract.sessions_per_month;
  const description = sessionsPerMonth
    ? `Pacote mensal — ${sessionsPerMonth} sessões — ${monthLabel}`
    : `Mensalidade — ${monthLabel}`;

  const { error } = await supabase.from("contract_invoices").insert({
    contract_id: contractId,
    due_date: dueDate,
    amount: contract.monthly_fee,
    status: "pendente",
    reference_month: monthStart,
    description,
  });

  if (error) {
    return { success: false, error: "Não foi possível gerar a fatura." };
  }

  revalidatePath("/gestor/contratos");
  return { success: true };
}

/**
 * Marca a fatura como paga e dispara a geração/envio do recibo
 * (lib/receipts.ts) em melhor esforço: uma falha de PDF/WhatsApp nunca
 * desfaz a confirmação de pagamento, que já foi persistida antes.
 */
export async function markInvoicePaid(invoiceId: string, formData?: FormData): Promise<ActionResult> {
  const paidMethodRaw = String(formData?.get("paidMethod") ?? "").trim();
  const payerName = String(formData?.get("payerName") ?? "").trim();
  const paidMethod = PAID_METHODS.includes(paidMethodRaw as (typeof PAID_METHODS)[number]) ? paidMethodRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("contract_invoices")
    .update({
      status: "pago",
      paid_at: new Date().toISOString(),
      paid_method: paidMethod,
      paid_by_name: payerName || null,
    })
    .eq("id", invoiceId);

  if (error) {
    return { success: false, error: "Não foi possível marcar a fatura como paga." };
  }

  try {
    const admin = createAdminClient();
    await generateReceiptForInvoice(admin, invoiceId, user?.id ?? null);
  } catch (err: unknown) {
    // Melhor esforço — o pagamento já foi confirmado acima, um recibo que
    // falhou pode ser reenviado depois pela tela de Recibos.
    console.error("[gestor/contratos] Falha ao gerar recibo da fatura:", err);
  }

  revalidatePath("/gestor/contratos");
  revalidatePath("/gestor/financeiro/recibos");
  return { success: true };
}
