import { test } from "node:test";
import assert from "node:assert/strict";
import { generate40MinSlotsForShift } from "../lib/pts-slots.ts";

test("generate40MinSlotsForShift - Manhã gera exatamente 6 slots de 40 minutos", () => {
  const slots = generate40MinSlotsForShift("MANHA");
  assert.equal(slots.length, 6);
  assert.deepEqual(slots, [
    "08:00 - 08:40",
    "08:40 - 09:20",
    "09:20 - 10:00",
    "10:00 - 10:40",
    "10:40 - 11:20",
    "11:20 - 12:00",
  ]);
});

test("generate40MinSlotsForShift - Tarde gera exatamente 6 slots de 40 minutos", () => {
  const slots = generate40MinSlotsForShift("TARDE");
  assert.equal(slots.length, 6);
  assert.deepEqual(slots, [
    "13:00 - 13:40",
    "13:40 - 14:20",
    "14:20 - 15:00",
    "15:00 - 15:40",
    "15:40 - 16:20",
    "16:20 - 17:00",
  ]);
});

test("generate40MinSlotsForShift - Noite gera exatamente 6 slots de 40 minutos", () => {
  const slots = generate40MinSlotsForShift("NOITE");
  assert.equal(slots.length, 6);
  assert.deepEqual(slots, [
    "17:00 - 17:40",
    "17:40 - 18:20",
    "18:20 - 19:00",
    "19:00 - 19:40",
    "19:40 - 20:20",
    "20:20 - 21:00",
  ]);
});
