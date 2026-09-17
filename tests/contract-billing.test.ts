import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMonthlyFee, nextInvoiceDueDate } from "../lib/contract-billing.ts";

test("computeMonthlyFee - multiplica valor unitário pelas sessões do mês", () => {
  assert.equal(computeMonthlyFee(200, 10), 2000);
  assert.equal(computeMonthlyFee(150, 8), 1200);
});

test("computeMonthlyFee - arredonda para 2 casas decimais", () => {
  assert.equal(computeMonthlyFee(33.33, 3), 99.99);
});

// Instante fixado ao meio-dia UTC do dia 15 — bem longe da virada de mês em
// qualquer fuso realista, para não confundir "o mês de referência" com "o
// dia do mês", que a própria função descarta.
function midMonthUtc(year: number, month1Indexed: number): Date {
  return new Date(Date.UTC(year, month1Indexed - 1, 15, 12));
}

test("nextInvoiceDueDate - dia normal dentro do mês", () => {
  const due = nextInvoiceDueDate(midMonthUtc(2026, 9), 15, "America/Sao_Paulo");
  assert.equal(due.getUTCFullYear(), 2026);
  assert.equal(due.getUTCMonth(), 8); // setembro (0-indexed)
  assert.equal(due.getUTCDate(), 15);
});

test("nextInvoiceDueDate - invoiceDay=31 em fevereiro (não bissexto) vira 28", () => {
  const due = nextInvoiceDueDate(midMonthUtc(2027, 2), 31, "America/Sao_Paulo");
  assert.equal(due.getUTCFullYear(), 2027);
  assert.equal(due.getUTCMonth(), 1); // fevereiro
  assert.equal(due.getUTCDate(), 28);
});

test("nextInvoiceDueDate - invoiceDay=31 em fevereiro bissexto vira 29", () => {
  const due = nextInvoiceDueDate(midMonthUtc(2028, 2), 31, "America/Sao_Paulo");
  assert.equal(due.getUTCFullYear(), 2028);
  assert.equal(due.getUTCMonth(), 1); // fevereiro
  assert.equal(due.getUTCDate(), 29);
});

test("nextInvoiceDueDate - invoiceDay=1 sempre cai no primeiro dia do mês", () => {
  const due = nextInvoiceDueDate(midMonthUtc(2026, 4), 1, "America/Sao_Paulo");
  assert.equal(due.getUTCDate(), 1);
});
