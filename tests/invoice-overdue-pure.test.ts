// tests/invoice-overdue-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { monthBounds, overdueInvoices, daysLate } from "../lib/invoice-overdue-pure.ts";

test("limites do mês em data civil, inclusive dezembro", () => {
  assert.deepEqual(monthBounds("2026-11-14"), { monthStart: "2026-11-01", nextMonthStart: "2026-12-01" });
  assert.deepEqual(monthBounds("2026-12-31"), { monthStart: "2026-12-01", nextMonthStart: "2027-01-01" });
  assert.deepEqual(monthBounds("2026-01-01"), { monthStart: "2026-01-01", nextMonthStart: "2026-02-01" });
});

test("em atraso = aberta e vencida antes deste mês, mais antiga primeiro", () => {
  const inv = [
    { id: "a", due_date: "2026-10-10", status: "pendente" },
    { id: "b", due_date: "2026-09-05", status: "atrasado" },
    { id: "c", due_date: "2026-10-20", status: "pago" },
    { id: "d", due_date: "2026-10-25", status: "cancelado" },
    { id: "e", due_date: "2026-11-05", status: "pendente" },
  ];
  assert.deepEqual(overdueInvoices(inv, "2026-11-01").map((i) => i.id), ["b", "a"]);
});

test("dias de atraso", () => {
  assert.equal(daysLate("2026-10-10", "2026-11-14"), 35);
  assert.equal(daysLate("2026-11-14", "2026-11-14"), 0);
  assert.equal(daysLate("2026-12-01", "2026-11-14"), 0);
  assert.equal(daysLate("2025-12-31", "2026-01-02"), 2);
});

test("a tela de contratos mostra a fatura em atraso com baixa (CTR-01)", () => {
  const src = readFileSync("app/gestor/contratos/page.tsx", "utf8");
  assert.ok(src.includes("overdueInvoices("));
  assert.ok(src.includes("Em atraso"));
});
