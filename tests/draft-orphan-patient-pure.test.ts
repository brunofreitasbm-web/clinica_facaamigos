import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPatientForOrphanDraft } from "../lib/draft-orphan-patient-pure.ts";

const davi = { id: "p-davi", full_name: "Davi Átila do Vale Brandão" };
const irmao = { id: "p-irmao", full_name: "Heitor Átila do Vale Brandão" };

test("mesmo telefone e mesma criança: devolve o paciente já cadastrado", () => {
  assert.equal(pickPatientForOrphanDraft("Davi Átila do Vale Brandão", [davi]), "p-davi");
});

test("irmão no mesmo telefone não é confundido: decide pelo primeiro nome", () => {
  assert.equal(pickPatientForOrphanDraft("Davi Átila do Vale Brandão", [irmao, davi]), "p-davi");
  assert.equal(pickPatientForOrphanDraft("Davi Átila do Vale Brandão", [irmao]), null);
});

test("sem nome da criança no rascunho: só aceita se houver um único candidato", () => {
  assert.equal(pickPatientForOrphanDraft(null, [davi]), "p-davi");
  assert.equal(pickPatientForOrphanDraft("", [davi, irmao]), null);
});

test("dois pacientes com o mesmo primeiro nome: ambíguo, não adivinha", () => {
  const davi2 = { id: "p-davi2", full_name: "Davi Souza" };
  assert.equal(pickPatientForOrphanDraft("Davi Átila", [davi, davi2]), null);
});

test("sem candidatos: null", () => {
  assert.equal(pickPatientForOrphanDraft("Davi", []), null);
});
