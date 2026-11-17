import test from "node:test";
import assert from "node:assert/strict";
import { PLAYGROUND_BLOCKS, blockForTime, capacityMessage, countInBlock, overCapacity } from "../lib/playground/grid.ts";

test("turnos fixos de 2h: 10h, 12h e 14h", () => {
  assert.deepEqual(
    PLAYGROUND_BLOCKS.map((b) => `${b.start}-${b.end}`),
    ["10:00-12:00", "12:00-14:00", "14:00-16:00"],
  );
  assert.equal(blockForTime("12:00")?.label, "12h às 14h");
  assert.equal(blockForTime("11:30")?.start, "10:00");
  assert.equal(blockForTime("10:00")?.label, "10h às 12h");
  assert.equal(blockForTime("09:00"), null);
  assert.equal(blockForTime("16:00"), null);
});

test("lotação: avisa acima de 2 crianças, sem bloquear", () => {
  const b = PLAYGROUND_BLOCKS[0]!;
  assert.equal(countInBlock(["10:00", "10:00", "12:00"], b), 2);
  assert.equal(overCapacity(2), false);
  assert.equal(overCapacity(3), true);
  assert.equal(capacityMessage(2), null);
  assert.match(capacityMessage(3) ?? "", /no máximo 2/);
});
