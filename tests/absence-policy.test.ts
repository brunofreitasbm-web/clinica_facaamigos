import { test } from "node:test";
import assert from "node:assert/strict";
import { countConsecutiveUnjustified, AUTO_DISCHARGE_THRESHOLD } from "../lib/absence-policy.ts";

test("countConsecutiveUnjustified - lista vazia devolve 0", () => {
  assert.equal(countConsecutiveUnjustified([]), 0);
});

test("countConsecutiveUnjustified - 2 faltas consecutivas não justificadas", () => {
  const result = countConsecutiveUnjustified([
    { status: "falta_familia", justified: false },
    { status: "falta_familia", justified: false },
  ]);
  assert.equal(result, 2);
  assert.equal(result >= AUTO_DISCHARGE_THRESHOLD, true);
});

test("countConsecutiveUnjustified - falta justificada no meio quebra a sequência", () => {
  const result = countConsecutiveUnjustified([
    { status: "falta_familia", justified: false },
    { status: "falta_familia", justified: true },
    { status: "falta_familia", justified: false },
  ]);
  assert.equal(result, 1);
});

test("countConsecutiveUnjustified - sessão realizada quebra a sequência", () => {
  const result = countConsecutiveUnjustified([
    { status: "falta_familia", justified: false },
    { status: "realizada", justified: false },
    { status: "falta_familia", justified: false },
  ]);
  assert.equal(result, 1);
});
