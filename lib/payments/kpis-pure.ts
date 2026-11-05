// lib/payments/kpis-pure.ts
// KPIs da cobrança particular. Todo KPI sai com comparativo (regra do projeto, AGENTS.md):
// vs mês anterior e/ou vs meta. PURO, testado em tests/kpis-pure.test.ts.
import { daysBetween } from "./billing-pure.ts";

/** Metas conservadoras do plano de negócios (PREMISSA: ajustar com dado real). */
export const KPI_TARGETS = {
  overdueAfter5DaysPct: 8,
  finalLossPct: 5,
  pixAutomaticAdoptionPct: 50,
};

export type KpiInvoice = {
  due_date: string;
  amount: number;
  status: string; // pendente | pago | atrasado | cancelado
  paid_at: string | null;
  payment_method: string | null;
};

export type KpiContract = {
  status: string;
  monthly_fee: number;
  payment_method: string;
  plan_code: string | null;
};

export type Kpi = { value: number; previous: number | null; target: number | null };

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den === 0 ? 0 : round1((num / den) * 100));

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function endOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Estava em aberto D+`days` depois do vencimento, olhando o mundo como era em `asOf`? */
function openAfter(inv: KpiInvoice, days: number, asOf: string): boolean {
  if (inv.status === "cancelado") return false;
  const paidDate = inv.paid_at ? inv.paid_at.slice(0, 10) : null;
  const paidByAsOf = paidDate !== null && paidDate <= asOf;
  if (paidByAsOf) return false;
  return daysBetween(inv.due_date, asOf) > days;
}

/** % das faturas VENCIDAS no mês `ym` que ainda estavam abertas D+`days` depois do vencimento, em `asOf`. */
function overduePct(invoices: KpiInvoice[], ym: string, days: number, asOf: string): number {
  const due = invoices.filter((i) => monthOf(i.due_date) === ym && i.status !== "cancelado" && i.due_date <= asOf);
  return pct(due.filter((i) => openAfter(i, days, asOf)).length, due.length);
}

export type CollectionKpis = {
  mrr: Kpi;
  overdueAfter5Days: Kpi;
  finalLoss: Kpi;
  pixAdoption: Kpi;
  aging: { bucket: "0-15" | "16-30" | "31-60" | ">60"; count: number; amount: number; previousCount: number }[];
};

/**
 * `today` e mês corrente em AAAA-MM-DD. "Mês anterior" = o mês civil anterior, avaliado no último dia
 * dele (para a inadimplência) ou pelos contratos que existiam (MRR, aproximado pelo estado atual).
 */
export function computeCollectionKpis(invoices: KpiInvoice[], contracts: KpiContract[], today: string): CollectionKpis {
  const cur = monthOf(today);
  const prev = shiftMonth(cur, -1);
  const prevEnd = endOfMonth(prev);

  const active = contracts.filter((c) => c.status === "ativo");
  const mrrNow = active.reduce((s, c) => s + Number(c.monthly_fee), 0);
  // Receita contratada no mês anterior = faturas emitidas com vencimento em ym (competência paga mês antes).
  const mrrPrev = invoices.filter((i) => monthOf(i.due_date) === prev && i.status !== "cancelado").reduce((s, i) => s + Number(i.amount), 0);

  // Inadimplência D+5: mês corrente avaliado hoje; mês anterior avaliado no último dia dele.
  const od5Now = overduePct(invoices, cur, 5, today);
  const od5Prev = overduePct(invoices, prev, 5, prevEnd);

  // Perda final: faturas vencidas há mais de 60 dias, em aberto, sobre a receita faturada vencida.
  const lossBase = invoices.filter((i) => i.status !== "cancelado" && daysBetween(i.due_date, today) > 0);
  const lossOpen = lossBase.filter((i) => openAfter(i, 60, today));
  const lossNow = lossBase.length === 0 ? 0 : round1((lossOpen.reduce((s, i) => s + Number(i.amount), 0) / lossBase.reduce((s, i) => s + Number(i.amount), 0)) * 100);
  const lossBasePrev = invoices.filter((i) => i.status !== "cancelado" && i.due_date <= prevEnd);
  const lossOpenPrev = lossBasePrev.filter((i) => openAfter(i, 60, prevEnd));
  const lossPrev = lossBasePrev.length === 0 ? 0 : round1((lossOpenPrev.reduce((s, i) => s + Number(i.amount), 0) / lossBasePrev.reduce((s, i) => s + Number(i.amount), 0)) * 100);

  const pixNow = pct(active.filter((c) => c.payment_method === "pix_automatico").length, active.length);
  const prevInv = invoices.filter((i) => monthOf(i.due_date) === prev && i.status !== "cancelado");
  const pixPrev = pct(prevInv.filter((i) => i.payment_method === "pix_automatico").length, prevInv.length);

  const buckets: CollectionKpis["aging"] = (["0-15", "16-30", "31-60", ">60"] as const).map((bucket) => ({ bucket, count: 0, amount: 0, previousCount: 0 }));
  const bucketOf = (d: number) => (d <= 15 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3);
  for (const i of invoices) {
    if (i.status === "cancelado") continue;
    const dNow = daysBetween(i.due_date, today);
    if (dNow > 0 && openAfter(i, 0, today)) {
      const b = buckets[bucketOf(dNow)];
      b.count++;
      b.amount += Number(i.amount);
    }
    const dPrev = daysBetween(i.due_date, prevEnd);
    if (dPrev > 0 && openAfter(i, 0, prevEnd)) buckets[bucketOf(dPrev)].previousCount++;
  }

  return {
    mrr: { value: mrrNow, previous: mrrPrev, target: null },
    overdueAfter5Days: { value: od5Now, previous: od5Prev, target: KPI_TARGETS.overdueAfter5DaysPct },
    finalLoss: { value: lossNow, previous: lossPrev, target: KPI_TARGETS.finalLossPct },
    pixAdoption: { value: pixNow, previous: pixPrev, target: KPI_TARGETS.pixAutomaticAdoptionPct },
    aging: buckets,
  };
}
