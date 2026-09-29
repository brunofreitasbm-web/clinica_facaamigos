// tests/ux-friction-report.test.ts
//
// Comparativo "menor é melhor" e textos da tela Facilidade de uso
// (lib/ux-friction-report.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareLowerIsBetter, describeRoute, describeTrend, formatNumber } from "../lib/ux-friction-report.ts";

test("dentro da meta e melhorando é bom", () => {
  const c = compareLowerIsBetter(8, 12, 15);
  assert.deepEqual(c, { trend: "melhor", delta: -4, withinGoal: true, tone: "bom" });
});

test("dentro da meta mas piorando pede atenção", () => {
  const c = compareLowerIsBetter(10, 5, 15);
  assert.equal(c.trend, "pior");
  assert.equal(c.withinGoal, true);
  assert.equal(c.tone, "atencao");
});

test("acima da meta pede atenção mesmo melhorando", () => {
  const c = compareLowerIsBetter(20, 30, 15);
  assert.equal(c.trend, "melhor");
  assert.equal(c.withinGoal, false);
  assert.equal(c.tone, "atencao");
});

test("oscilação de centésimos é 'igual'", () => {
  assert.equal(compareLowerIsBetter(10.02, 10, 15).trend, "igual");
});

test("sem semana anterior não inventa comparação; sem valor é sem_dados", () => {
  const first = compareLowerIsBetter("8.5", null, "15");
  assert.equal(first.trend, "sem_comparacao");
  assert.equal(first.delta, null);
  assert.equal(first.withinGoal, true);
  assert.equal(first.tone, "bom");
  assert.equal(compareLowerIsBetter(null, 5, 15).tone, "sem_dados");
});

test("aceita numeric vindo como texto do Postgres", () => {
  assert.equal(compareLowerIsBetter("12.50", "10.00", "15.00").trend, "pior");
});

test("describeTrend e formatNumber em pt-BR", () => {
  assert.equal(describeTrend(compareLowerIsBetter(12.5, 10, 15), "pp"), "piorou 2,5 pp vs semana passada");
  assert.equal(describeTrend(compareLowerIsBetter(5, null, 15), "pp"), "sem semana anterior para comparar");
  assert.equal(describeTrend(compareLowerIsBetter(10, 10, 15), "pp"), "igual à semana passada");
  assert.equal(formatNumber(null), "—");
  assert.equal(formatNumber("9.62"), "9,6");
});

test("describeRoute traduz a rota para algo legível", () => {
  assert.equal(describeRoute("/recepcao/pacientes/:id/editar"), "Recepção › Pacientes › (um item) › Editar");
  assert.equal(describeRoute("/gestor/financeiro-hub"), "Gestão › Financeiro HUB");
  assert.equal(describeRoute("/"), "Início");
  assert.equal(describeRoute("/recepcao/algo-novo"), "Recepção › Algo novo");
});
