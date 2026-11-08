import { NextRequest, NextResponse } from "next/server";
import { createBillingDb } from "@/lib/payments/db";
import { normalizeAsaasEvent, tokensMatch, type NormalizedPaymentEvent } from "@/lib/payments/asaas-pure";
import { fallbackOnPixAutomaticFailure } from "@/lib/payments/billing-pure";
import { getPaymentProvider, isPaymentGatewayConfigured } from "@/lib/payments";

/**
 * Webhook do Asaas (cobranças e Pix Automático). Configurar no painel do Asaas com o mesmo
 * valor de ASAAS_WEBHOOK_TOKEN (o Asaas envia no header `asaas-access-token`).
 *
 * - Entrega "pelo menos uma vez": o evento é gravado em payment_events (unique por id do evento)
 *   ANTES de processar. Evento repetido e já processado responde 200 sem refazer nada; evento
 *   gravado mas não processado (falha anterior) é reprocessado.
 * - Falha de processamento responde 500 para o Asaas tentar de novo.
 * - Baixa é idempotente: só atualiza fatura que ainda não está paga.
 * - Pagamento que não casa com nenhuma fatura NÃO é descartado: fica em payment_events com
 *   erro 'unmatched_payment' para o gestor resolver.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  if (!tokensMatch(expected, req.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const ev = normalizeAsaasEvent(payload);
  if (!ev) return NextResponse.json({ error: "invalid_event" }, { status: 400 });

  const db = createBillingDb();

  const { data: existing } = await db
    .from("payment_events")
    .select("id, processed_at")
    .eq("gateway", "asaas")
    .eq("gateway_event_id", ev.eventId)
    .maybeSingle();
  if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  let eventRowId = existing?.id as string | undefined;
  if (!eventRowId) {
    const { data: ins, error: insErr } = await db
      .from("payment_events")
      .insert({ gateway: "asaas", gateway_event_id: ev.eventId, event_type: ev.rawEvent, payload })
      .select("id")
      .single();
    if (insErr || !ins) {
      // corrida com outra entrega do mesmo evento: deixa o Asaas repetir
      return NextResponse.json({ error: "persist_failed" }, { status: 500 });
    }
    eventRowId = ins.id as string;
  }

  try {
    const result = await applyEvent(db, ev);
    await db
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), invoice_id: result.invoiceId ?? null, contract_id: result.contractId ?? null, error: result.error ?? null })
      .eq("id", eventRowId);
    return NextResponse.json({ ok: true, ...(result.error ? { warning: result.error } : {}) });
  } catch (e) {
    await db.from("payment_events").update({ error: String(e).slice(0, 500) }).eq("id", eventRowId);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

type Db = ReturnType<typeof createBillingDb>;
type Applied = { invoiceId?: string; contractId?: string; error?: string };

type InvoiceRow = {
  id: string;
  contract_id: string;
  amount: number;
  status: string;
  patient_contracts: { plan_code: string | null } | null;
};

async function findInvoiceByCharge(db: Db, chargeId?: string): Promise<InvoiceRow | null> {
  if (!chargeId) return null;
  const { data } = await db
    .from("contract_invoices")
    .select("id, contract_id, amount, status, patient_contracts(plan_code)")
    .eq("gateway_charge_id", chargeId)
    .maybeSingle();
  return data as unknown as InvoiceRow | null;
}

async function applyEvent(db: Db, ev: NormalizedPaymentEvent): Promise<Applied> {
  switch (ev.kind) {
    case "payment_received": {
      let inv: InvoiceRow | null = await findInvoiceByCharge(db, ev.chargeId);
      if (!inv && ev.customerId && ev.chargeId) {
        // 1º pagamento da autorização do Pix Automático: foi pago no QR da autorização, não numa
        // cobrança nossa. Casa pelo cliente + valor com a fatura em aberto mais antiga sem cobrança.
        const { data: contract } = await db.from("patient_contracts").select("id").eq("gateway_customer_id", ev.customerId).maybeSingle();
        if (contract) {
          const { data: open } = await db
            .from("contract_invoices")
            .select("id, contract_id, amount, status, patient_contracts(plan_code)")
            .eq("contract_id", contract.id)
            .in("status", ["pendente", "atrasado"])
            .is("gateway_charge_id", null)
            .order("due_date", { ascending: true })
            .limit(5);
          const match = ((open ?? []) as unknown as InvoiceRow[]).find((i) => ev.paidAmount === undefined || Number(i.amount) === ev.paidAmount);
          if (match) {
            await db.from("contract_invoices").update({ gateway_charge_id: ev.chargeId }).eq("id", match.id).is("gateway_charge_id", null);
            inv = match;
          }
        }
      }
      if (!inv) return { error: "unmatched_payment" };

      const paid = ev.paidAmount ?? Number(inv.amount);
      await db
        .from("contract_invoices")
        .update({
          status: "pago",
          paid_at: ev.paidAt ? new Date(`${ev.paidAt}T12:00:00-03:00`).toISOString() : new Date().toISOString(),
          paid_amount: paid,
          net_amount: ev.netAmount ?? null,
          fine_interest_amount: Math.max(0, Math.round((paid - Number(inv.amount)) * 100) / 100),
          gateway_status: "RECEIVED",
        })
        .eq("id", inv.id)
        .neq("status", "pago");
      return { invoiceId: inv.id, contractId: inv.contract_id };
    }

    case "payment_overdue":
    case "payment_refunded":
    case "payment_deleted": {
      const inv = await findInvoiceByCharge(db, ev.chargeId);
      if (!inv) return { error: "unknown_charge" };
      const gwStatus = ev.kind === "payment_overdue" ? "OVERDUE" : ev.kind === "payment_refunded" ? "REFUNDED" : "DELETED";
      await db.from("contract_invoices").update({ gateway_status: gwStatus }).eq("id", inv.id);
      if (ev.kind === "payment_refunded") {
        await db.from("patient_contracts").update({ needs_review: true, needs_review_reason: "Estorno recebido: conferir a fatura" }).eq("id", inv.contract_id);
      }
      return { invoiceId: inv.id, contractId: inv.contract_id };
    }

    case "authorization_active": {
      if (!ev.authorizationId) return { error: "missing_authorization_id" };
      const { data } = await db
        .from("patient_contracts")
        .update({ pix_authorization_status: "ACTIVE" })
        .eq("pix_authorization_id", ev.authorizationId)
        .select("id");
      return data?.[0] ? { contractId: data[0].id } : { error: "unknown_authorization" };
    }

    case "authorization_failed": {
      if (!ev.authorizationId) return { error: "missing_authorization_id" };
      const { data: contract } = await db
        .from("patient_contracts")
        .select("id, plan_code")
        .eq("pix_authorization_id", ev.authorizationId)
        .maybeSingle();
      if (!contract) return { error: "unknown_authorization" };
      const status = ev.rawEvent.endsWith("_REFUSED") ? "REFUSED" : ev.rawEvent.endsWith("_EXPIRED") ? "EXPIRED" : "CANCELLED";
      const fallback = fallbackOnPixAutomaticFailure(contract.plan_code);
      await db
        .from("patient_contracts")
        .update({
          pix_authorization_status: status,
          needs_review: true,
          needs_review_reason: `Pix Automático ${status.toLowerCase()}${ev.reason ? ` (${ev.reason})` : ""}${fallback === "manual_review" ? ": Pacote Ponte exige Pix Automático, decidir com a família" : ": novas faturas serão emitidas em boleto"}`,
          ...(fallback === "emit_boleto" ? { payment_method: "boleto" } : {}),
        })
        .eq("id", contract.id);
      if (fallback === "emit_boleto") await reopenPendingInvoicesAsBoleto(db, contract.id);
      return { contractId: contract.id };
    }

    case "instruction_refused": {
      const inv = await findInvoiceByCharge(db, ev.chargeId);
      if (!inv) return { error: "unknown_charge" };
      const fallback = fallbackOnPixAutomaticFailure(inv.patient_contracts?.plan_code);
      await db.from("contract_invoices").update({ gateway_status: "INSTRUCTION_REFUSED" }).eq("id", inv.id);
      if (fallback === "emit_boleto") {
        await reopenPendingInvoicesAsBoleto(db, inv.contract_id, inv.id);
      } else {
        await db.from("patient_contracts").update({ needs_review: true, needs_review_reason: "Débito do Pix Automático recusado no Pacote Ponte: falar com a família" }).eq("id", inv.contract_id);
      }
      return { invoiceId: inv.id, contractId: inv.contract_id };
    }

    default:
      return {};
  }
}

/**
 * Faturas em aberto de um contrato voltam para a fila de emissão como boleto. A cobrança antiga
 * do gateway é cancelada (melhor esforço: se falhar, o gestor vê o evento e a fatura nova só sai
 * porque a antiga deixa de ter gateway_charge_id).
 */
async function reopenPendingInvoicesAsBoleto(db: Db, contractId: string, onlyInvoiceId?: string) {
  let q = db
    .from("contract_invoices")
    .select("id, gateway_charge_id")
    .eq("contract_id", contractId)
    .in("status", ["pendente", "atrasado"]);
  if (onlyInvoiceId) q = q.eq("id", onlyInvoiceId);
  const { data } = await q;
  const provider = isPaymentGatewayConfigured() ? getPaymentProvider() : null;
  for (const row of (data ?? []) as { id: string; gateway_charge_id: string | null }[]) {
    if (row.gateway_charge_id && provider) {
      try { await provider.cancelCharge(row.gateway_charge_id); } catch { /* melhor esforço */ }
    }
    await db
      .from("contract_invoices")
      .update({ payment_method: "boleto", gateway_charge_id: null, gateway_status: null, pix_code: null, boleto_url: null })
      .eq("id", row.id);
  }
}
