import test from "node:test";
import assert from "node:assert/strict";
import { computeCollectionKpis, type KpiInvoice, type KpiContract } from "../lib/payments/kpis-pure.ts";
import { isValidCpf } from "../lib/payments/cpf-pure.ts";

const inv = (due: string, status: string, paid: string | null, method = "boleto", amount = 1000): KpiInvoice =>
  ({ due_date: due, amount, status, paid_at: paid, payment_method: method });
const ct = (method: string, fee = 1000): KpiContract => ({ status: "ativo", monthly_fee: fee, payment_method: method, plan_code: null });

test("toda KPI sai com comparativo (anterior e/ou meta)", () => {
  const k = computeCollectionKpis([inv("2026-10-25", "pago", "2026-10-25T12:00:00Z")], [ct("boleto")], "2026-11-10");
  for (const key of ["overdueAfter5Days", "finalLoss", "pixAdoption"] as const) {
    assert.notEqual(k[key].previous, undefined);
    assert.notEqual(k[key].target, null, key);
  }
  assert.notEqual(k.mrr.previous, null);
});

test("inadimplência D+5: pago em dia não conta; aberta há mais de 5 dias conta", () => {
  const invoices = [
    inv("2026-11-01", "pago", "2026-11-01T12:00:00Z"),
    inv("2026-11-02", "atrasado", null),
    inv("2026-11-08", "pendente", null), // só 2 dias de atraso em 10/11: ainda não conta
    inv("2026-11-09", "pago", "2026-11-12T12:00:00Z"), // pago depois de hoje (futuro): conta como aberto hoje? não: paid_at > asOf
  ];
  const k = computeCollectionKpis(invoices, [ct("boleto")], "2026-11-10");
  // vencidas no mês até hoje: 4; abertas há >5d: só a de 11-02 (8 dias)
  assert.equal(k.overdueAfter5Days.value, 25);
});

test("pago com atraso: no mês anterior estava em aberto, hoje não", () => {
  const invoices = [inv("2026-10-05", "pago", "2026-11-03T12:00:00Z")];
  const k = computeCollectionKpis(invoices, [ct("boleto")], "2026-11-10");
  assert.equal(k.overdueAfter5Days.previous, 100); // em 31/10 estava 26 dias em aberto
  assert.equal(k.aging.reduce((s, b) => s + b.count, 0), 0); // hoje já pagou
  assert.equal(k.aging[1].previousCount, 1); // 26 dias → faixa 16-30
});

test("adesão ao Pix Automático e MRR", () => {
  const k = computeCollectionKpis([], [ct("pix_automatico", 1050), ct("boleto", 1400), ct("pix_automatico", 1050), ct("boleto", 720)], "2026-11-10");
  assert.equal(k.pixAdoption.value, 50);
  assert.equal(k.mrr.value, 4220);
});

test("sem dados não quebra nem devolve NaN", () => {
  const k = computeCollectionKpis([], [], "2026-11-10");
  assert.equal(k.overdueAfter5Days.value, 0);
  assert.equal(k.finalLoss.value, 0);
  assert.equal(k.pixAdoption.value, 0);
});

test("CPF: válido, inválido, repetido, formatado", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("529.982.247-24"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("123"), false);
});
