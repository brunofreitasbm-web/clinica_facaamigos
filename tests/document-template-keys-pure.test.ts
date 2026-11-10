// tests/document-template-keys-pure.test.ts
//
// template_key das cobranças: uma chave, várias chaves numa mensagem só, e o que não é cobrança.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATE_KEY_PREFIX, joinTemplateKeys, splitTemplateKeys } from "../lib/document-template-keys-pure.ts";

const KNOWN = ["laudo_medico", "pedido_medico", "carteirinha", "documento_responsavel"] as const;

test("joinTemplateKeys: uma chave igual ao formato antigo; várias com +", () => {
  assert.equal(joinTemplateKeys(["laudo_medico"]), "documento_pendente:laudo_medico");
  assert.equal(joinTemplateKeys(["laudo_medico", "pedido_medico"]), "documento_pendente:laudo_medico+pedido_medico");
});

test("splitTemplateKeys: desdobra, ignora desconhecidas e repetidas", () => {
  assert.deepEqual(splitTemplateKeys("documento_pendente:laudo_medico", KNOWN), ["laudo_medico"]);
  assert.deepEqual(splitTemplateKeys("documento_pendente:laudo_medico+pedido_medico", KNOWN), ["laudo_medico", "pedido_medico"]);
  assert.deepEqual(splitTemplateKeys("documento_pendente:laudo_medico+xyz+laudo_medico", KNOWN), ["laudo_medico"]);
});

test("splitTemplateKeys: o que não é cobrança vira lista vazia", () => {
  assert.deepEqual(splitTemplateKeys(null, KNOWN), []);
  assert.deepEqual(splitTemplateKeys("abertura_documentos", KNOWN), []);
  assert.deepEqual(splitTemplateKeys(TEMPLATE_KEY_PREFIX, KNOWN), []);
});

test("ida e volta", () => {
  const keys = ["carteirinha", "documento_responsavel"] as const;
  assert.deepEqual(splitTemplateKeys(joinTemplateKeys(keys), KNOWN), [...keys]);
});
