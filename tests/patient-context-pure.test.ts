// tests/patient-context-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPatientContextBlock, guideWarning, type PatientContext } from "../lib/patient-context-pure.ts";

const TODAY = "2026-11-09";
const base: PatientContext = {
  childFirstName: "Ana",
  guideValidTo: "2027-03-01",
  guideSessionsLeft: 20,
  nextSessionLabel: "ter., 10/11 às 14:00",
  nextSessionIsEvaluation: false,
};

test("guia confortável: contexto sem aviso proativo", () => {
  assert.equal(guideWarning(base, TODAY), null);
  const block = buildPatientContextBlock(base, TODAY);
  assert.match(block, /Ana/);
  assert.match(block, /ter\., 10\/11 às 14:00/);
  assert.match(block, /01\/03\/2027/);
  assert.doesNotMatch(block, /AVISO/);
});

test("guia vencendo ou com poucas sessões gera aviso proativo", () => {
  assert.match(guideWarning({ ...base, guideValidTo: "2026-11-20" }, TODAY) ?? "", /vence em 11 dia/);
  assert.match(guideWarning({ ...base, guideSessionsLeft: 3 }, TODAY) ?? "", /restam apenas 3/);
  assert.match(guideWarning({ ...base, guideSessionsLeft: 0 }, TODAY) ?? "", /acabaram/);
  assert.match(guideWarning({ ...base, guideValidTo: "2026-11-01" }, TODAY) ?? "", /já venceu/);
  assert.match(buildPatientContextBlock({ ...base, guideSessionsLeft: 2 }, TODAY), /AVISO PROATIVO/);
});

test("sem dados úteis ou sem contexto: bloco vazio", () => {
  assert.equal(buildPatientContextBlock(null, TODAY), "");
  assert.equal(
    buildPatientContextBlock({ childFirstName: null, guideValidTo: null, guideSessionsLeft: null, nextSessionLabel: null, nextSessionIsEvaluation: false }, TODAY),
    "",
  );
});

test("avaliação é rotulada como avaliação e o bloco não expõe sobrenome", () => {
  const block = buildPatientContextBlock({ ...base, nextSessionIsEvaluation: true }, TODAY);
  assert.match(block, /Próxima avaliação/);
  assert.doesNotMatch(block, /Souza|Silva/);
});
