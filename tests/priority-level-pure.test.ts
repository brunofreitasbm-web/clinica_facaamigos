// tests/priority-level-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPriorityLevel, isValidPriorityLevel } from "../lib/priority-level-pure.ts";

test("plano sem prioridade começa no nível 1 (antes dava -Infinity)", () => {
  assert.equal(nextPriorityLevel([]), 1);
});

test("próximo nível é o maior existente mais 1, mesmo com buracos", () => {
  assert.equal(nextPriorityLevel([1]), 2);
  assert.equal(nextPriorityLevel([1, 2, 3]), 4);
  assert.equal(nextPriorityLevel([2, 5]), 6);
});

test("valores inválidos na lista são ignorados", () => {
  assert.equal(nextPriorityLevel([Number.NaN, 3]), 4);
  assert.equal(nextPriorityLevel([Number.NaN]), 1);
});

test("validação recusa NaN, fora do intervalo e decimais", () => {
  assert.ok(isValidPriorityLevel(1) && isValidPriorityLevel(10));
  assert.ok(!isValidPriorityLevel(Number.NaN));
  assert.ok(!isValidPriorityLevel(0) && !isValidPriorityLevel(11));
  assert.ok(!isValidPriorityLevel(2.5));
  assert.ok(!isValidPriorityLevel(parseInt("-Infinity")));
});
