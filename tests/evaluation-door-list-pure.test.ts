// tests/evaluation-door-list-pure.test.ts
//
// A lista fica no acrílico da porta: o que sai impresso precisa ser a forma
// reduzida do nome, nunca o nome completo da criança.
import { test } from "node:test";
import assert from "node:assert/strict";
import { abbreviateName, buildDoorListRows } from "../lib/evaluation-door-list-pure.ts";

test("primeiro nome + inicial do último sobrenome", () => {
  assert.equal(abbreviateName("Davi Lopes Souza"), "Davi S.");
  assert.equal(abbreviateName("Helena Santos"), "Helena S.");
});

test("partículas não viram inicial", () => {
  assert.equal(abbreviateName("Ana de Souza"), "Ana S.");
  assert.equal(abbreviateName("Pedro dos Santos da Silva"), "Pedro S.");
});

test("nome de uma palavra, vazio e espaços extras", () => {
  assert.equal(abbreviateName("Miguel"), "Miguel");
  assert.equal(abbreviateName("   "), "");
  assert.equal(abbreviateName("  alice   ribeiro "), "alice R.");
});

test("só partícula depois do primeiro nome devolve o primeiro nome", () => {
  assert.equal(abbreviateName("Bia de"), "Bia");
});

test("buildDoorListRows ordena por hora, abrevia e preenche responsável ausente", () => {
  const rows = buildDoorListRows([
    { time: "14:00", patient: "Theo Moreira", guardian: null, therapist: "Beatriz Nogueira" },
    { time: "08:00", patient: "Davi Lopes", guardian: "Mariana Lopes", therapist: "Dra. Camila Rocha" },
  ]);
  assert.deepEqual(rows.map((r) => r.time), ["08:00", "14:00"]);
  assert.equal(rows[0].patient, "Davi L.");
  assert.equal(rows[0].guardian, "Mariana L.");
  assert.equal(rows[1].guardian, "—");
  assert.equal(rows[1].therapist, "Beatriz Nogueira");
});
