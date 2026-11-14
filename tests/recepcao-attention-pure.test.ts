// tests/recepcao-attention-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttentionItems } from "../lib/recepcao-attention-pure.ts";

const zero = { chegadas: 0, familias: 0, guias: 0, pendencias: 0 };

test("tudo zerado não gera nenhum item (a home mostra 'em dia')", () => {
  assert.deepEqual(buildAttentionItems(zero), []);
});

test("ordem de urgência: chegada física, família no WhatsApp, guia, pendência", () => {
  const keys = buildAttentionItems({ chegadas: 1, familias: 2, guias: 3, pendencias: 4 }).map((i) => i.key);
  assert.deepEqual(keys, ["chegadas", "familias", "guias", "pendencias"]);
});

test("itens com quantidade zero somem", () => {
  const keys = buildAttentionItems({ ...zero, familias: 2, pendencias: 1 }).map((i) => i.key);
  assert.deepEqual(keys, ["familias", "pendencias"]);
});

test("singular e plural concordam no texto", () => {
  const one = buildAttentionItems({ ...zero, chegadas: 1 })[0];
  const many = buildAttentionItems({ ...zero, chegadas: 3 })[0];
  assert.match(one.label, /^1 pessoa chegou .* espera confirmação$/);
  assert.match(many.label, /^3 pessoas chegaram .* esperam confirmação$/);
  assert.match(buildAttentionItems({ ...zero, familias: 1 })[0].label, /^1 família nova/);
});

test("cada item aponta para um destino e tem um verbo de ação", () => {
  for (const i of buildAttentionItems({ chegadas: 1, familias: 1, guias: 1, pendencias: 1 })) {
    assert.ok(i.href.length > 1);
    assert.ok(i.action.length > 0);
  }
});
