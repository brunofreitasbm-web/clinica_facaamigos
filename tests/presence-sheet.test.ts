import { test } from "node:test";
import assert from "node:assert/strict";
import { monthRangeInTimeZone } from "../lib/timezone.ts";

const TZ = "America/Sao_Paulo";

test("monthRangeInTimeZone - mês comum devolve início inclusive e fim exclusivo", () => {
  const { startIso, endIso } = monthRangeInTimeZone("2026-03", TZ);
  // 2026-03-01 00:00 em São Paulo (UTC-3) = 2026-03-01T03:00:00Z
  assert.equal(startIso, "2026-03-01T03:00:00.000Z");
  // Fim exclusivo = início de abril no mesmo fuso.
  assert.equal(endIso, "2026-04-01T03:00:00.000Z");
});

test("monthRangeInTimeZone - dezembro vira janeiro do ano seguinte", () => {
  const { startIso, endIso } = monthRangeInTimeZone("2026-12", TZ);
  assert.equal(startIso, "2026-12-01T03:00:00.000Z");
  assert.equal(endIso, "2027-01-01T03:00:00.000Z");
});

test("monthRangeInTimeZone - intervalo é sempre um mês (start < end)", () => {
  const { startIso, endIso } = monthRangeInTimeZone("2026-02", TZ);
  assert.ok(new Date(startIso).getTime() < new Date(endIso).getTime());
});
