// tests/relatorio-reavaliacao.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { goalStatusLabel } from "../lib/goal-status-label-pure.ts";

test("rótulo de meta cobre os 3 status reais do plano", () => {
  assert.equal(goalStatusLabel("atingida").tone, "ok");
  assert.equal(goalStatusLabel("suspensa").tone, "back");
  assert.equal(goalStatusLabel("ativa").tone, "wait");
  assert.equal(goalStatusLabel("qualquer-outro").tone, "wait");
});

test("o relatório de reavaliação não carrega paciente, convênio nem parecer de exemplo (PTS-01)", () => {
  const files = ["app/supervisao/relatorio-dialog.tsx", "app/supervisao/planos-panel.tsx"].map((f) => readFileSync(f, "utf8")).join("\n");
  for (const fake of ["876.543.210-01", "Bradesco", "Carolina Mendon", "14/05/2019", "F84.0", "Gabriel Santos Silva", "boa receptividade", "evolução clínica significativa"]) {
    assert.ok(!files.includes(fake), `valor de exemplo reapareceu: ${fake}`);
  }
});
