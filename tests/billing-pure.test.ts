import test from "node:test";
import assert from "node:assert/strict";
import {
  invoiceDueDate, nextCompetence, proratedAmount, lateCharges, resolveBillingMethod,
  chargeDescription, nextDunningStep, isWithinSendWindow, todayInSaoPaulo,
  fallbackOnPixAutomaticFailure, shouldEmitNow, PONTE_PLAN_CODE, daysBetween,
} from "../lib/payments/billing-pure.ts";

test("pré-pago: dezembro vence em 25 de novembro; janeiro em 25 de dezembro do ano anterior", () => {
  assert.equal(invoiceDueDate("2026-12-01"), "2026-11-25");
  assert.equal(invoiceDueDate("2027-01-01"), "2026-12-25");
  assert.equal(invoiceDueDate("2027-03-01", 31), "2027-02-28");
});

test("próxima competência vira o ano", () => {
  assert.equal(nextCompetence("2026-12-15"), "2027-01-01");
  assert.equal(nextCompetence("2026-05-31"), "2026-06-01");
});

test("proporcional de entrada nunca passa do cheio nem fica negativo", () => {
  assert.equal(proratedAmount(1050, 6, 3), 525);
  assert.equal(proratedAmount(1050, 6, 9), 1050);
  assert.equal(proratedAmount(1050, 6, -1), 0);
});

test("encargos: 2% de multa + 1% a.m. pro rata, sem atraso nada", () => {
  assert.deepEqual(lateCharges(1400, "2026-11-25", "2026-11-25"), { fine: 0, interest: 0, total: 1400, daysLate: 0 });
  const c = lateCharges(1400, "2026-11-25", "2026-12-25");
  assert.equal(c.fine, 28);
  assert.equal(c.interest, 14);
  assert.equal(c.total, 1442);
  assert.equal(lateCharges(1400, "2026-11-25", "2026-11-20").total, 1400);
});

test("Pacote Ponte só aceita Pix Automático", () => {
  assert.equal(resolveBillingMethod(PONTE_PLAN_CODE, "boleto").ok, false);
  assert.deepEqual(resolveBillingMethod(PONTE_PLAN_CODE, "pix_automatico"), { ok: true, method: "pix_automatico" });
  assert.deepEqual(resolveBillingMethod("PART-PLANO-LACO", "boleto"), { ok: true, method: "boleto" });
});

test("descrição do boleto não cita terapia nem diagnóstico", () => {
  const d = chargeDescription("2026-12-01");
  assert.equal(d, "Serviços de saúde – competência 12/2026 – Instituto Faça Amigos");
  assert.doesNotMatch(d, /ABA|TEA|TDAH|terapia|autis/i);
});

test("régua: D−1 só para boleto; um passo por execução; sem repetir", () => {
  assert.equal(nextDunningStep(-5, "boleto", null), "d_minus_5");
  assert.equal(nextDunningStep(-1, "boleto", "d_minus_5"), "d_minus_1");
  assert.equal(nextDunningStep(-1, "pix_automatico", "d_minus_5"), null);
  assert.equal(nextDunningStep(1, "boleto", "d_minus_1"), "d_plus_1");
  assert.equal(nextDunningStep(1, "boleto", "d_plus_1"), null);
  assert.equal(nextDunningStep(3, "boleto", "d_plus_1"), "d_plus_3");
});

test("régua: atraso descoberto tarde dispara só o passo mais recente alcançado", () => {
  assert.equal(nextDunningStep(12, "boleto", null), "d_plus_10_formal");
  assert.equal(nextDunningStep(40, "boleto", "d_plus_15_notice"), "d_plus_30_suspension");
  assert.equal(nextDunningStep(0, "boleto", "d_minus_1"), null);
});

test("janela de envio: 8h–20h, segunda a sábado (America/Sao_Paulo)", () => {
  // 2026-11-05 é quinta. 12:00Z = 09:00 em São Paulo (UTC−3).
  assert.equal(isWithinSendWindow(new Date("2026-11-05T12:00:00Z")), true);
  assert.equal(isWithinSendWindow(new Date("2026-11-05T10:59:00Z")), false); // 07:59
  assert.equal(isWithinSendWindow(new Date("2026-11-05T23:00:00Z")), false); // 20:00
  assert.equal(isWithinSendWindow(new Date("2026-11-08T15:00:00Z")), false); // domingo
  assert.equal(isWithinSendWindow(new Date("2026-11-07T15:00:00Z")), true); // sábado
});

test("hoje em São Paulo vira o dia às 03:00Z", () => {
  assert.equal(todayInSaoPaulo(new Date("2026-11-05T02:59:00Z")), "2026-11-04");
  assert.equal(todayInSaoPaulo(new Date("2026-11-05T03:00:00Z")), "2026-11-05");
});

test("falha do Pix Automático: Ponte vai para revisão humana, demais viram boleto", () => {
  assert.equal(fallbackOnPixAutomaticFailure(PONTE_PLAN_CODE), "manual_review");
  assert.equal(fallbackOnPixAutomaticFailure("PART-PLANO-LACO"), "emit_boleto");
});

test("janela de emissão do Pix Automático respeita 2–10 dias úteis", () => {
  assert.equal(shouldEmitNow(3, "pix_automatico"), false);
  assert.equal(shouldEmitNow(4, "pix_automatico"), true);
  assert.equal(shouldEmitNow(13, "pix_automatico"), true);
  assert.equal(shouldEmitNow(14, "pix_automatico"), false);
  assert.equal(shouldEmitNow(14, "boleto"), true);
  assert.equal(shouldEmitNow(0, "boleto"), false);
});

test("daysBetween", () => {
  assert.equal(daysBetween("2026-11-25", "2026-11-30"), 5);
  assert.equal(daysBetween("2026-12-01", "2026-11-25"), -6);
});
