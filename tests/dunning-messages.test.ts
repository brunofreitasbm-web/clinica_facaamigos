import test from "node:test";
import assert from "node:assert/strict";
import { dunningMessage } from "../lib/payments/dunning-messages.ts";
import { DUNNING_ORDER, HUMAN_ONLY_STEPS } from "../lib/payments/billing-pure.ts";

const ctx = { name: "Maria da Silva", amount: 1050, dueDate: "2026-11-25", reference: "2026-12-01", method: "boleto" as const, link: "https://b/1" };

test("todo passo automático gera mensagem sem dado de saúde", () => {
  for (const step of DUNNING_ORDER.filter((s) => !HUMAN_ONLY_STEPS.has(s))) {
    const m = dunningMessage(step, ctx);
    assert.doesNotMatch(m.text + m.subject, /ABA|TEA\b|TDAH|autis|terapia|crian|paciente|terapeuta/i, step);
    assert.match(m.text, /R\$ 1050,00/);
    assert.match(m.text, /25\/11\/2026/);
    assert.match(m.text, /12\/2026/);
    assert.deepEqual(m.variables, { "1": "Maria", "2": "R$ 1050,00", "3": "25/11/2026", "4": "12/2026" });
  }
});

test("Pix Automático diz que o débito é automático e não manda link de boleto", () => {
  const m = dunningMessage("d_minus_5", { ...ctx, method: "pix_automatico" });
  assert.match(m.text, /Pix Automático/);
  assert.doesNotMatch(m.text, /https:/);
});

test("atraso cita multa de 2% e juros de 1% só a partir de D+3", () => {
  assert.doesNotMatch(dunningMessage("d_plus_1", ctx).text, /multa/);
  assert.match(dunningMessage("d_plus_3", ctx).text, /multa de 2% e juros de 1% ao mês/);
});

test("passo humano não tem mensagem automática", () => {
  assert.throws(() => dunningMessage("d_plus_15_notice", ctx));
});

test("sem nome, cumprimenta de forma neutra", () => {
  assert.match(dunningMessage("d_plus_1", { ...ctx, name: null }).text, /^Olá! /);
});
