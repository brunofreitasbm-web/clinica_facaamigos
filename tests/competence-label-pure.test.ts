// tests/competence-label-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { competenceLabel } from "../lib/competence-label-pure.ts";

test("competência vira mês por extenso", () => {
  assert.equal(competenceLabel("2026-11"), "novembro de 2026");
  assert.equal(competenceLabel("2026-03-01"), "março de 2026");
  assert.equal(competenceLabel("2027-01"), "janeiro de 2027");
});

test("entrada fora do padrão volta como veio (nunca inventa um mês)", () => {
  assert.equal(competenceLabel("2026-13"), "2026-13");
  assert.equal(competenceLabel("novembro"), "novembro");
});

test("fechar repasses pede confirmação com o mês, nas duas telas (FIN-02)", () => {
  for (const f of ["app/gestor/financeiro/financeiro-tabs.tsx", "app/faturamento/repasses/repasses-actions.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(src.includes("ClosePayoutsConfirm"), `${f} precisa usar o componente com confirmação`);
    assert.ok(!/onClick=\{handleClose\}/.test(src), `${f} voltou a fechar no primeiro clique`);
  }
});
