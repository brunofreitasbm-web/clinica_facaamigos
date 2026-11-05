import { NextRequest, NextResponse } from "next/server";
import { createBillingDb, isCronAuthorized } from "@/lib/payments/db";
import {
  HUMAN_ONLY_STEPS,
  daysBetween,
  isWithinSendWindow,
  nextDunningStep,
  todayInSaoPaulo,
  type BillingMethod,
  type DunningStep,
} from "@/lib/payments/billing-pure";
import { dunningMessage } from "@/lib/payments/dunning-messages";
import { getTwilioContentSidForCategory, sendTwilioWhatsApp } from "@/lib/twilio";
import { isWhatsAppWindowOpen } from "@/lib/whatsapp-window";
import { sendEmail } from "@/lib/email";

/**
 * Régua de cobrança. Chamada todo dia pelo pg_cron (job `billing-dunning`).
 * - Mensagens automáticas (WhatsApp, com e-mail de reserva) só em passos de lembrete/atraso;
 *   D+6 (ligação), D+15 (notificação formal) e D+30 (suspensão de novos agendamentos) viram
 *   TAREFA para uma pessoa e NUNCA disparam negativação, protesto nem suspensão sozinhos.
 * - Só entre 8h e 20h, de segunda a sábado (America/Sao_Paulo).
 * - Um passo por fatura por execução; o passo é gravado antes do envio e revertido se falhar,
 *   para a próxima execução tentar de novo sem repetir mensagem já entregue.
 * - O texto nunca cita terapia, diagnóstico nem a criança (LGPD art. 11).
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isWithinSendWindow(new Date())) return NextResponse.json({ skipped: "outside_send_window" });

  const db = createBillingDb();
  const today = todayInSaoPaulo();
  const lo = new Date(Date.parse(`${today}T00:00:00Z`) - 45 * 86_400_000).toISOString().slice(0, 10);
  const hi = new Date(Date.parse(`${today}T00:00:00Z`) + 5 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await db
    .from("contract_invoices")
    .select(
      "id, due_date, amount, reference_month, payment_method, last_dunning_step, boleto_url, pix_code, patient_contracts!inner(payment_method, status, financial_responsible_name, financial_responsible_email, financial_responsible_phone)",
    )
    .in("status", ["pendente", "atrasado"])
    .eq("patient_contracts.status", "ativo")
    .gte("due_date", lo)
    .lte("due_date", hi)
    .limit(300);
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });

  const out = { sent: 0, tasks: 0, failed: 0, skipped: 0 };

  type Inv = {
    id: string; due_date: string; amount: number; reference_month: string | null;
    payment_method: BillingMethod | null; last_dunning_step: DunningStep | null;
    boleto_url: string | null; pix_code: string | null;
    patient_contracts: { payment_method: BillingMethod; financial_responsible_name: string | null; financial_responsible_email: string | null; financial_responsible_phone: string | null };
  };

  for (const inv of (data ?? []) as unknown as Inv[]) {
    const c = inv.patient_contracts;
    const method = inv.payment_method ?? c.payment_method;
    const offset = daysBetween(inv.due_date, today);
    const step = nextDunningStep(offset, method, inv.last_dunning_step);
    if (!step) { out.skipped++; continue; }

    const prev = inv.last_dunning_step;
    const { data: claimed } = await db
      .from("contract_invoices")
      .update({ last_dunning_step: step, last_dunning_at: new Date().toISOString() })
      .eq("id", inv.id)
      .filter("last_dunning_step", prev ? "eq" : "is", prev ?? null)
      .select("id");
    if (!claimed || claimed.length === 0) { out.skipped++; continue; }

    if (HUMAN_ONLY_STEPS.has(step)) {
      await db.from("dunning_log").insert({ invoice_id: inv.id, step, channel: "task", result: "pending_human", detail: "Exige ação de uma pessoa (ligação, notificação formal ou decisão de suspensão)." });
      out.tasks++;
      continue;
    }

    const msg = dunningMessage(step, {
      name: c.financial_responsible_name,
      amount: Number(inv.amount),
      dueDate: inv.due_date,
      reference: inv.reference_month ?? inv.due_date,
      method,
      link: inv.boleto_url,
      pixCode: inv.pix_code,
    });

    let delivered = false;
    let detail = "";

    if (c.financial_responsible_phone) {
      const contentSid = getTwilioContentSidForCategory(msg.category);
      const canFreeText = !contentSid && (await isWhatsAppWindowOpen(c.financial_responsible_phone));
      if (contentSid || canFreeText) {
        const r = await sendTwilioWhatsApp({
          to: c.financial_responsible_phone,
          message: msg.text,
          ...(contentSid ? { contentSid, contentVariables: msg.variables } : {}),
        });
        delivered = r.success;
        detail = r.success ? `whatsapp:${r.messageId}` : `whatsapp_failed:${r.error ?? r.errorCode}`;
        await db.from("dunning_log").insert({ invoice_id: inv.id, step, channel: "whatsapp", result: r.success ? "sent" : "failed", detail });
      } else {
        detail = "whatsapp_skipped:sem_template_e_janela_fechada";
      }
    }

    if (!delivered && c.financial_responsible_email) {
      const r = await sendEmail({ to: c.financial_responsible_email, subject: msg.subject, html: `<p>${msg.text}</p>`, text: msg.text });
      delivered = r.success;
      await db.from("dunning_log").insert({ invoice_id: inv.id, step, channel: "email", result: r.success ? "sent" : "failed", detail: r.success ? r.id : r.error });
    }

    if (delivered) {
      out.sent++;
    } else {
      // Nada entregue: devolve o passo para a próxima execução tentar de novo.
      await db.from("contract_invoices").update({ last_dunning_step: prev }).eq("id", inv.id);
      out.failed++;
      if (detail) await db.from("dunning_log").insert({ invoice_id: inv.id, step, channel: "task", result: "undelivered", detail });
    }
  }

  return NextResponse.json(out);
}
