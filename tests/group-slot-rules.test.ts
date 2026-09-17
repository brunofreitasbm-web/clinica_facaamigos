import { test } from "node:test";
import assert from "node:assert/strict";
import { canJoinGroupSlot } from "../lib/group-slot-rules.ts";

test("canJoinGroupSlot - slot vazio sempre ok", () => {
  const result = canJoinGroupSlot({
    existingBirthDates: [],
    maxSize: 3,
    candidateBirthDate: new Date("2018-05-10"),
  });
  assert.deepEqual(result, { ok: true });
});

test("canJoinGroupSlot - 3/3 lotado, bloqueia mesmo com idade compatível", () => {
  const result = canJoinGroupSlot({
    existingBirthDates: [new Date("2017-01-01"), new Date("2017-06-01"), new Date("2018-01-01")],
    maxSize: 3,
    candidateBirthDate: new Date("2017-08-01"),
  });
  assert.deepEqual(result, { ok: false, reason: "lotado" });
});

test("canJoinGroupSlot - exatamente 2 anos de diferença é ok", () => {
  const result = canJoinGroupSlot({
    existingBirthDates: [new Date("2016-03-15")],
    maxSize: 3,
    candidateBirthDate: new Date("2018-03-15"),
  });
  assert.deepEqual(result, { ok: true });
});

test("canJoinGroupSlot - 2 anos e 1 dia de diferença bloqueia por faixa etária", () => {
  const result = canJoinGroupSlot({
    existingBirthDates: [new Date("2016-03-15")],
    maxSize: 3,
    candidateBirthDate: new Date("2018-03-16"),
  });
  assert.deepEqual(result, { ok: false, reason: "faixa_etaria" });
});
