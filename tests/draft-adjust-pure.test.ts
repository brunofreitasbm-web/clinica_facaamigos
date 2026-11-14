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
