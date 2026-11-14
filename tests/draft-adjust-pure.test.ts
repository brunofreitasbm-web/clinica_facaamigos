import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAdjustmentToBotCollected } from "../lib/draft-adjust-pure.ts";

const values = {
  childName: "Maria Souza",
  birthDate: "2020-05-10",
  guardianName: "Ana Souza",
  guardianCpf: "12345678909",
  guardianEmail: "ana@exemplo.com",
  cardNumber: "999",
};

test("corrige as chaves que o bot já guardou", () => {
  const next = applyAdjustmentToBotCollected(
    { child_name: "Maria Sousa", guardian_name: "Ana", card_number: "111", last_step: "x" },
    values,
  );
  assert.deepEqual(next, { child_name: "Maria Souza", guardian_name: "Ana Souza", card_number: "999", last_step: "x" });
});

test("nunca cria chave nova no que o bot guardou (não mexe no andamento do fluxo)", () => {
  const next = applyAdjustmentToBotCollected({ child_name: "Maria Sousa" }, values);
  assert.deepEqual(Object.keys(next ?? {}), ["child_name"]);
});

test("sem nada a mudar (ou sem bot_collected), devolve null", () => {
  assert.equal(applyAdjustmentToBotCollected(null, values), null);
  assert.equal(applyAdjustmentToBotCollected({}, values), null);
  assert.equal(applyAdjustmentToBotCollected({ child_name: "Maria Souza" }, values), null);
});

test("limpar o campo no ajuste limpa a chave do bot, para a leitura cair no extraído já limpo", () => {
  const next = applyAdjustmentToBotCollected({ guardian_email: "velho@x.com" }, { ...values, guardianEmail: "" });
  assert.deepEqual(next, { guardian_email: "" });
});

import { applyManualOverrides, computeManualOverrides } from "../lib/draft-adjust-pure.ts";

const nextOf = (over: Record<string, Record<string, string>> = {}) => ({
  patient: { full_name: "Maria Souza", birth_date: "2020-05-10", cpf: "", cid: "", complaint_hint: "", ...over.patient },
  guardian: { full_name: "Ana Souza", phone: "", cpf: "", email: "", ...over.guardian },
  insurance: { card_number: "999", ...over.insurance },
});

test("correções: guarda só o que o operador mudou em relação ao que o rascunho tinha", () => {
  const current = { patient: { full_name: "Maria Sousa", birth_date: "2020-05-10" }, guardian: { full_name: "Ana Souza" }, insurance: { card_number: "111" } };
  const o = computeManualOverrides(current, nextOf(), null);
  assert.deepEqual(o, { patient: { full_name: "Maria Souza" }, insurance: { card_number: "999" } });
});

test("campo que estava vazio e continua vazio não vira correção (a IA ainda pode ler o CPF depois)", () => {
  const current = { patient: { full_name: "Maria Souza", birth_date: "2020-05-10" }, guardian: { full_name: "Ana Souza" }, insurance: { card_number: "" } };
  const o = computeManualOverrides(current, nextOf({ insurance: { card_number: "" } }), null);
  assert.deepEqual(o, {});
});

test("apagar um valor errado vira correção com null; telefone e queixa nunca são limpos pelo formulário", () => {
  const current = { patient: { full_name: "Maria Souza", cpf: "11111111111", complaint_hint: "x" }, guardian: { full_name: "Ana Souza", phone: "+5511999999999" }, insurance: { card_number: "999" } };
  const o = computeManualOverrides(current, nextOf(), null);
  assert.deepEqual(o, { patient: { cpf: null, birth_date: "2020-05-10" } });
});

test("correção nova do mesmo campo vence a antiga, e as antigas de outros campos continuam", () => {
  const previous = { patient: { cid: "F84" }, guardian: { email: "a@x.com" } };
  const current = { patient: { full_name: "Maria Souza", birth_date: "2020-05-10", cid: "F84" }, guardian: { full_name: "Ana Souza", email: "a@x.com" }, insurance: { card_number: "999" } };
  const o = computeManualOverrides(current, nextOf({ patient: { cid: "F90" }, guardian: { email: "a@x.com" } }), previous);
  assert.deepEqual(o, { patient: { cid: "F90" }, guardian: { email: "a@x.com" } });
});

test("reaplicar por cima da leitura nova: a correção vence a IA e o resto da leitura fica", () => {
  const reread = { patient: { full_name: "Maria Sousa", cpf: "22222222222" }, guardian: { full_name: "Ana" }, documents: [1] };
  const out = applyManualOverrides(reread, { patient: { full_name: "Maria Souza", cpf: null }, insurance: { card_number: "999" } });
  assert.deepEqual(out, {
    patient: { full_name: "Maria Souza", cpf: null },
    guardian: { full_name: "Ana" },
    documents: [1],
    insurance: { card_number: "999" },
  });
});

test("sem correções (ou lixo no lugar), devolve a leitura como veio", () => {
  const reread = { patient: { full_name: "Maria" } };
  assert.deepEqual(applyManualOverrides(reread, null), reread);
  assert.deepEqual(applyManualOverrides(reread, { patient: { full_name: 42 }, outro: { x: "y" } }), reread);
});
