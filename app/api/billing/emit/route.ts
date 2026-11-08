import { NextRequest, NextResponse } from "next/server";
import { createBillingDb, isCronAuthorized } from "@/lib/payments/db";
import { getPaymentProvider, isPaymentGatewayConfigured } from "@/lib/payments";
import { PaymentProviderError } from "@/lib/payments/provider";
import {
  chargeDescription,
  daysBetween,
  shouldEmitNow,
  todayInSaoPaulo,
  type BillingMethod,
} from "@/lib/payments/billing-pure";

/**
 * Emite no gateway as faturas pendentes que entraram na janela de emissão. Chamado todo dia
 * pelo pg_cron (job `billing-emit`, supabase/migrations/20261105120000_payments_gateway_billing.sql).
 *
 * - Pix Automático: só emite se a autorização do contrato estiver ACTIVE e a fatura vencer entre
 *   4 e 13 dias (2 a 10 dias úteis, exigência do Asaas). A 1ª fatura NÃO passa por aqui: ela é
 *   paga no QR da própria autorização (ver createPixAuthorization em app/gestor/contratos).
 * - Boleto: emite com até 14 dias de antecedência.
 * - Cada fatura é "reivindicada" (gateway_status = 'emitting') antes da chamada ao gateway, para
 *   duas execuções simultâneas nunca criarem duas cobranças.
 */
const BATCH = 50;

type Row = {
  id: string;
  due_date: string;
  amount: number;
  reference_month: string | null;
  payment_method: BillingMethod | null;
  patient_contracts: {
    id: string;
    payment_method: BillingMethod;
    gateway_customer_id: string | null;
    pix_authorization_id: string | null;
    pix_authorization_status: string | null;
    financial_responsible_name: string | null;
    financial_responsible_cpf: string | null;
    financial_responsible_email: string | null;
    financial_responsible_phone: string | null;
  };
};

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPaymentGatewayConfigured()) return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });

  const db = createBillingDb();
  const provider = getPaymentProvider();
  const today = todayInSaoPaulo();

  const { data, error } = await db
    .from("contract_invoices")
    .select(
      "id, due_date, amount, reference_month, payment_method, patient_contracts!inner(id, payment_method, gateway_customer_id, pix_authorization_id, pix_authorization_status, financial_responsible_name, financial_responsible_cpf, financial_responsible_email, financial_responsible_phone, status)",
    )
    .eq("status", "pendente")
    .is("gateway_charge_id", null)
    .is("gateway_status", null)
    .eq("patient_contracts.status", "ativo")
    .order("due_date", { ascending: true })
    .limit(BATCH * 4);
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });

  // Reivindicações que sobraram de uma execução interrompida (queda no meio da emissão). O cron é
  // diário e serial, então no início de uma execução nenhuma outra está viva.
  await db.from("contract_invoices").update({ gateway_status: null }).eq("gateway_status", "emitting").is("gateway_charge_id", null);

  const summary = { emitted: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const inv of ((data ?? []) as unknown as Row[]).slice(0, BATCH * 4)) {
    if (summary.emitted + summary.failed >= BATCH) break;
    const c = inv.patient_contracts;
    const method: BillingMethod = inv.payment_method ?? c.payment_method;
    if (!shouldEmitNow(daysBetween(today, inv.due_date), method)) { summary.skipped++; continue; }
    if (method === "pix_automatico" && c.pix_authorization_status !== "ACTIVE") { summary.skipped++; continue; }

    // Reivindica a fatura; se outra execução chegou antes, o update não casa nenhuma linha.
    const { data: claimed } = await db
      .from("contract_invoices")
      .update({ gateway_status: "emitting", payment_method: method })
      .eq("id", inv.id)
      .is("gateway_charge_id", null)
      .is("gateway_status", null)
      .select("id");
    if (!claimed || claimed.length === 0) { summary.skipped++; continue; }

    const release = () => db.from("contract_invoices").update({ gateway_status: null }).eq("id", inv.id);

    try {
      let customerId = c.gateway_customer_id;
      if (!customerId) {
        if (!c.financial_responsible_name || !c.financial_responsible_cpf) {
          await db.from("patient_contracts").update({ needs_review: true, needs_review_reason: "Falta nome/CPF do responsável financeiro" }).eq("id", c.id);
          await release();
          summary.skipped++;
          continue;
        }
        customerId = (await provider.upsertCustomer({
          externalReference: c.id,
          name: c.financial_responsible_name,
          cpfCnpj: c.financial_responsible_cpf,
          email: c.financial_responsible_email,
          mobilePhone: c.financial_responsible_phone,
        })).id;
        await db.from("patient_contracts").update({ gateway_customer_id: customerId }).eq("id", c.id);
      }

      const description = chargeDescription(inv.reference_month ?? inv.due_date);
      // Se uma tentativa anterior criou a cobrança no gateway mas não conseguiu gravar aqui, reaproveita.
      const existing = await provider.findChargeByExternalReference(inv.id);
      const charge =
        existing
          ? existing
          : method === "pix_automatico"
          ? await provider.createPixAutomaticCharge({
              customerId,
              authorizationId: c.pix_authorization_id as string,
              value: Number(inv.amount),
              dueDate: inv.due_date,
              description,
              externalReference: inv.id,
            })
          : await provider.createBoleto({
              customerId,
              value: Number(inv.amount),
              dueDate: inv.due_date,
              description,
              externalReference: inv.id,
            });

      await db
        .from("contract_invoices")
        .update({
          gateway_charge_id: charge.id,
          gateway_status: charge.status,
          boleto_url: charge.boletoUrl ?? null,
          pix_code: charge.pixPayload ?? null,
        })
        .eq("id", inv.id);
      summary.emitted++;
    } catch (e) {
      await release();
      summary.failed++;
      summary.errors.push(`${inv.id}: ${e instanceof PaymentProviderError ? `${e.status} ${e.message}` : String(e)}`);
    }
  }

  return NextResponse.json(summary);
}
