// tests/interessado-queue-pure.test.ts
//
// Interessado cadastrado à mão (sem rascunho de documentos) precisa de ação de
// guia direto no item da fila; os demais itens continuam como estavam.
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsGuideAction } from "../lib/interessado-queue-pure.ts";

const base = { category: "cadastro_incompleto", patientId: "p1", patientStatus: "interessado", hasDraft: false };

test("interessado manual com cadastro parado: pede ação de guia", () => {
  assert.equal(needsGuideAction(base), true);
});

test("interessado sem retorno também pode lançar guia", () => {
  assert.equal(needsGuideAction({ ...base, category: "interessado_sem_retorno" }), true);
});

test("com rascunho de documentos a esteira própria cuida: sem ação de guia", () => {
  assert.equal(needsGuideAction({ ...base, hasDraft: true }), false);
});

test("paciente já promovido (avaliação/ativo) não mostra a ação", () => {
  assert.equal(needsGuideAction({ ...base, patientStatus: "avaliacao" }), false);
  assert.equal(needsGuideAction({ ...base, patientStatus: "ativo" }), false);
  assert.equal(needsGuideAction({ ...base, patientStatus: null }), false);
});

test("sem paciente vinculado ou em outra categoria: não mostra", () => {
  assert.equal(needsGuideAction({ ...base, patientId: null }), false);
  assert.equal(needsGuideAction({ ...base, category: "guia_vencendo" }), false);
});
