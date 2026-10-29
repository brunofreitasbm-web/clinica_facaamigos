// tests/evaluation-recipient-pure.test.ts
//
// O aviso da 1ª avaliação vai pro responsável. A regra tem que ser a mesma na
// tela de agendar e no envio, e nunca devolver alguém sem telefone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickEvaluationRecipient, type GuardianContact } from "../lib/evaluation-recipient-pure.ts";

const g = (over: Partial<GuardianContact>): GuardianContact => ({
  full_name: "Ana Souza",
  phone: "(91) 99999-0000",
  is_financial: false,
  ...over,
});

test("sem responsáveis: null", () => {
  assert.equal(pickEvaluationRecipient([]), null);
});

test("ninguém com telefone: null (a supervisão precisa saber que não vai sair aviso)", () => {
  assert.equal(pickEvaluationRecipient([g({ phone: null }), g({ phone: "  " })]), null);
});

test("o financeiro com telefone vence, mesmo vindo depois na lista", () => {
  const r = pickEvaluationRecipient([g({ full_name: "Pai Lima", phone: "91911110000" }), g({ full_name: "Mãe Lima", phone: "91922220000", is_financial: true })]);
  assert.equal(r?.name, "Mãe Lima");
  assert.equal(r?.phone, "91922220000");
});

test("financeiro sem telefone: cai no próximo que tem (não perde o aviso)", () => {
  const r = pickEvaluationRecipient([g({ full_name: "Mãe Lima", phone: null, is_financial: true }), g({ full_name: "Pai Lima", phone: "91911110000" })]);
  assert.equal(r?.name, "Pai Lima");
});

test("primeiro nome pro template; sem nome vira \"família\"", () => {
  assert.equal(pickEvaluationRecipient([g({ full_name: "  Maria  das Dores " })])?.firstName, "Maria");
  const semNome = pickEvaluationRecipient([g({ full_name: null })]);
  assert.equal(semNome?.firstName, "família");
  assert.equal(semNome?.name, null);
});
