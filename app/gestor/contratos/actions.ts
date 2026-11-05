"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { loadParticularPlanCatalog } from "@/lib/particular-plans";
import { billingModeForPlan } from "@/lib/particular-plans-pure";
import { createBillingDb } from "@/lib/payments/db";
import { getPaymentProvider, isPaymentGatewayConfigured } from "@/lib/payments";
import { isValidCpf, onlyDigits } from "@/lib/payments/cpf-pure";
import {
  chargeDescription,
  resolveBillingMethod,
  todayInSaoPaulo,
  type BillingMethod,
} from "@/lib/payments/billing-pure";

type ActionResult = { success: true } | { success: false; error: string };

const PLAN_TYPES = ["particular", "reembolso_assistido", "coparticipacao"] as const;

/**
 * Cadastro de contrato particular/reembolso/co-participação. RLS
 * (patient_contracts_write) é o portão real, restrito a gestor.
 */
export async function createContract(formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const planType = String(formData.get("planType") ?? "");
  let monthlyFee = Number(formData.get("monthlyFee"));
  const packageCode = String(formData.get("packageCode") ?? "").trim();
  const paymentDay = Number(formData.get("paymentDay"));
  const startDate = String(formData.get("startDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const requestedMethod = (String(formData.get("paymentMethod") ?? "pix_automatico") === "boleto" ? "boleto" : "pix_automatico") as BillingMethod;
  const respName = String(formData.get("respName") ?? "").trim();
  const respCpf = onlyDigits(String(formData.get("respCpf") ?? ""));
  const respEmail = String(formData.get("respEmail") ?? "").trim();
  const respPhone = onlyDigits(String(formData.get("respPhone") ?? ""));

  if (!patientId) return { success: false, error: "Selecione um paciente." };
  if (!PLAN_TYPES.includes(planType as (typeof PLAN_TYPES)[number])) {
    return { success: false, error: "Selecione uma modalidade válida." };
  }
  const supabase = await createClient();

  // Particular puro: o valor é o do PACOTE (catálogo global, igual para qualquer
  // terapia). O valor digitado no formulário é ignorado, para a mensalidade nunca
  // divergir da tabela que o bot e o faturamento usam. As demais modalidades
  // (reembolso assistido, co-participação) seguem com mensalidade informada.
  let packageFields: { billing_mode: "avulsa" | "pacote"; sessions_per_month: number; unit_price: number; plan_code: string } | null = null;
  let paymentMethod: BillingMethod = requestedMethod;
  if (planType === "particular") {
    const plan = (await loadParticularPlanCatalog(supabase)).find((p) => p.code === packageCode);
    if (!plan) return { success: false, error: "Selecione o pacote do contrato." };
    // O Pacote Ponte só existe no Pix Automático; os demais aceitam boleto.
    const resolved = resolveBillingMethod(plan.code, requestedMethod);
    if (!resolved.ok) return { success: false, error: resolved.reason };
    paymentMethod = resolved.method;
    // Cobrança pelo gateway exige quem paga: nome e CPF válido do responsável financeiro.
    if (!respName) return { success: false, error: "Informe o nome do responsável financeiro." };
    if (!isValidCpf(respCpf)) return { success: false, error: "CPF do responsável financeiro inválido." };
    monthlyFee = plan.price;
    packageFields = {
      billing_mode: billingModeForPlan(plan),
      sessions_per_month: plan.sessions,
      unit_price: Math.round((plan.price / plan.sessions) * 100) / 100,
      plan_code: plan.code,
    };
  }

  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
    return { success: false, error: "Informe uma mensalidade válida." };
  }
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    return { success: false, error: "O dia de vencimento precisa ser entre 1 e 31." };
  }

  // Paciente com plano de saúde não entra em contrato "particular puro".
  if (planType === "particular") {
    const { data: plans } = await supabase
      .from("patient_insurance")
      .select("id")
      .eq("patient_id", patientId)
      .eq("is_private", false)
      .not("insurer_id", "is", null)
      .limit(1);
    if (plans && plans.length > 0) {
      return {
        success: false,
        error: "Este paciente tem plano de saúde — não é possível criar contrato particular puro. Use reembolso assistido ou co-participação.",
      };
    }
  }

  const { error } = await supabase.from("patient_contracts").insert({
    clinic_id: DEV_CLINIC_ID,
    patient_id: patientId,
    plan_type: planType,
    monthly_fee: monthlyFee,
    payment_day: paymentDay,
    // Pré-pago: a fatura da competência vence neste dia do mês ANTERIOR (padrão 25).
    invoice_day: paymentDay,
    start_date: startDate || undefined,
    notes: notes || null,
    ...(packageFields
      ? {
          payment_method: paymentMethod,
          financial_responsible_name: respName,
          financial_responsible_cpf: respCpf,
          financial_responsible_email: respEmail || null,
          financial_responsible_phone: respPhone || null,
        }
      : {}),
    ...(packageFields ?? {}),
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

/**
 * Baixa MANUAL (dinheiro, transferência fora do gateway). Só gestor (RLS), com motivo obrigatório,
 * registrada em payment_events com quem deu a baixa. A baixa normal vem do webhook do gateway.
 */
export async function markInvoicePaid(invoiceId: string, reason: string): Promise<ActionResult> {
  const why = reason.trim();
  if (why.length < 5) return { success: false, error: "Informe o motivo da baixa manual (mín. 5 caracteres)." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: updated, error } = await supabase
    .from("contract_invoices")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .neq("status", "pago")
    .select("id, contract_id");

  if (error || !updated || updated.length === 0) {
    return { success: false, error: "Não foi possível marcar a fatura como paga." };
  }

  await createBillingDb().from("payment_events").insert({
    gateway: "manual",
    gateway_event_id: `manual:${invoiceId}:${Date.now()}`,
    event_type: "manual_settlement",
    invoice_id: invoiceId,
    contract_id: updated[0].contract_id,
    actor_id: auth.user?.id ?? null,
    note: why,
    processed_at: new Date().toISOString(),
  });

  revalidatePath("/gestor/contratos");
  return { success: true };
}

export type PixAuthorizationResult =
  | { success: true; qrPayload: string | null; status: string }
  | { success: false; error: string };

/**
 * Cria a autorização do Pix Automático de um contrato. A família autoriza o débito ao pagar o QR da
 * 1ª mensalidade (Asaas, "Jornada 3"); a autorização só fica ACTIVE depois, por webhook. As cobranças
 * seguintes saem sozinhas pelo job de emissão. Valor FIXO: mudar o preço exige cancelar e criar outra.
 */
export async function createPixAuthorization(contractId: string): Promise<PixAuthorizationResult> {
  if (!isPaymentGatewayConfigured()) return { success: false, error: "Gateway de pagamento ainda não configurado (ASAAS_API_KEY)." };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("patient_contracts")
    .select("id, status, monthly_fee, payment_method, pix_authorization_id, pix_authorization_status, gateway_customer_id, financial_responsible_name, financial_responsible_cpf, financial_responsible_email, financial_responsible_phone")
    .eq("id", contractId)
    .maybeSingle();
  if (!c) return { success: false, error: "Contrato não encontrado (ou sem permissão de gestor)." };
  if (c.status !== "ativo") return { success: false, error: "Só contratos ativos." };
  if (c.payment_method !== "pix_automatico") return { success: false, error: "Este contrato é de boleto." };
  if (["CREATED", "ACTIVE"].includes(c.pix_authorization_status ?? "")) return { success: false, error: "Este contrato já tem uma autorização em andamento." };
  if (!c.financial_responsible_name || !c.financial_responsible_cpf) return { success: false, error: "Falta nome/CPF do responsável financeiro." };

  const db = createBillingDb();
  const today = todayInSaoPaulo();

  // 1ª fatura em aberto (sem cobrança no gateway); se não houver, gera a da próxima competência.
  const findOpen = () =>
    db.from("contract_invoices").select("id, amount, due_date").eq("contract_id", contractId).in("status", ["pendente", "atrasado"]).is("gateway_charge_id", null).order("due_date", { ascending: true }).limit(1).maybeSingle();
  let { data: first } = await findOpen();
  if (!first) {
    await db.rpc("generate_package_invoices");
    ({ data: first } = await findOpen());
  }
  if (!first) return { success: false, error: "Não há fatura em aberto para a 1ª cobrança do Pix Automático." };

  // Fatura recém-criada pode nascer vencida (contrato criado depois do dia 25): dá 3 dias para o 1º pagamento.
  const minDue = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);
  if (first.due_date < minDue) await db.from("contract_invoices").update({ due_date: minDue }).eq("id", first.id);

  try {
    const provider = getPaymentProvider();
    let customerId = c.gateway_customer_id as string | null;
    if (!customerId) {
      customerId = (await provider.upsertCustomer({
        externalReference: c.id,
        name: c.financial_responsible_name,
        cpfCnpj: c.financial_responsible_cpf,
        email: c.financial_responsible_email,
        mobilePhone: c.financial_responsible_phone,
      })).id;
    }
    const auth = await provider.createPixAutomaticAuthorization({
      customerId,
      contractId: c.id,
      startDate: today,
      value: Number(c.monthly_fee),
      description: chargeDescription(today).slice(0, 35),
      firstChargeValue: Number(first.amount),
      qrExpirationSeconds: 3 * 86_400,
    });
    await db
      .from("patient_contracts")
      .update({ gateway_customer_id: customerId, pix_authorization_id: auth.id, pix_authorization_status: auth.status, pix_authorization_qr: auth.qrPayload ?? null, needs_review: false, needs_review_reason: null })
      .eq("id", c.id);
    revalidatePath("/gestor/contratos");
    return { success: true, qrPayload: auth.qrPayload ?? null, status: auth.status };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Falha ao criar a autorização no gateway." };
  }
}
