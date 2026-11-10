// tests/intake-actions-pure.test.ts
//
// Textos da Fila de entrada: aviso de pendência acima do botão da etapa 2 e a mensagem única de cobrança.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChaseMessage, buildPendingWarning, joinPt, normalizeChaseKeys } from "../lib/intake-actions-pure.ts";
import type { ChaseKey } from "../lib/lead-pendencies.ts";

test("aviso: sem pendência não há aviso", () => {
  assert.equal(buildPendingWarning([]), null);
});

test("aviso: um item no singular", () => {
  assert.equal(buildPendingWarning(["carteirinha"]), "Falta carteirinha. O plano pode negar.");
});

test("aviso: laudo e pedido médico, texto exato do spec", () => {
  assert.equal(buildPendingWarning(["laudo_medico", "pedido_medico"]), "Faltam laudo e pedido médico. O plano pode negar.");
});

test("aviso: ordem fixa e sem repetição, mesmo com entrada fora de ordem", () => {
  assert.equal(buildPendingWarning(["pedido_medico", "laudo_medico", "pedido_medico"]), "Faltam laudo e pedido médico. O plano pode negar.");
});

test("aviso: três e quatro itens com vírgula e 'e' só no fim", () => {
  assert.equal(
    buildPendingWarning(["laudo_medico", "pedido_medico", "carteirinha"]),
    "Faltam laudo, pedido médico e carteirinha. O plano pode negar.",
  );
  assert.equal(
    buildPendingWarning(["documento_responsavel", "carteirinha", "pedido_medico", "laudo_medico"]),
    "Faltam laudo, pedido médico, carteirinha e documento do responsável. O plano pode negar.",
  );
});

test("joinPt e normalizeChaseKeys", () => {
  assert.equal(joinPt([]), "");
  assert.equal(joinPt(["a"]), "a");
  assert.equal(joinPt(["a", "b"]), "a e b");
  assert.equal(joinPt(["a", "b", "c"]), "a, b e c");
  assert.deepEqual(normalizeChaseKeys(["carteirinha", "xyz", "laudo_medico", "carteirinha"]), ["laudo_medico", "carteirinha"]);
});

const ALL: ChaseKey[] = ["laudo_medico", "pedido_medico", "carteirinha", "documento_responsavel"];

test("mensagem: lista todos os itens pendentes, cada um uma vez", () => {
  const msg = buildChaseMessage([...ALL, "laudo_medico"], "João Pedro Silva");
  for (const needle of ["*laudo médico*", "*pedido médico*", "*carteirinha do plano de saúde*", "*documento do responsável*"]) {
    assert.equal(msg.split(needle).length - 1, 1, `${needle} aparece uma vez`);
  }
  assert.equal(msg.split("\n• ").length - 1, 4, "quatro itens em lista");
  assert.match(msg, /do\(a\) João junto ao plano/);
  assert.match(msg, /^Olá! Aqui é da /);
  assert.match(msg, /esses documentos não chegam/);
});

test("mensagem: um item vai no singular, sem lista", () => {
  const msg = buildChaseMessage(["pedido_medico"]);
  assert.match(msg, /ainda está faltando o \*pedido médico\*/);
  assert.doesNotMatch(msg, /•/);
  assert.match(msg, /da criança junto ao plano/);
  assert.match(msg, /esse documento não chega/);
});

test("mensagem: sem itens é vazia; nunca usa travessão", () => {
  assert.equal(buildChaseMessage([]), "");
  assert.doesNotMatch(buildChaseMessage(ALL, "Ana"), /[—–]/);
  assert.doesNotMatch(buildPendingWarning(ALL) ?? "", /[—–]/);
});
