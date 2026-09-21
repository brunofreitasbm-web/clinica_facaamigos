// tests/format-due-short.test.ts
//
// fmtDueShort (lib/format.ts): prazo curto da Fila de pendências — o dia é
// comparado no fuso da clínica, não no do servidor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDueShort } from "../lib/format.ts";

const TZ = "America/Belem"; // UTC-3, sem horário de verão
// 21/09/2026 15:00 em Belém
const NOW = new Date("2026-09-21T18:00:00Z");

test("hoje, amanhã e ontem", () => {
  assert.equal(fmtDueShort("2026-09-21T22:43:01Z", TZ, NOW), "hoje 19:43");
  assert.equal(fmtDueShort("2026-09-22T15:00:00Z", TZ, NOW), "amanhã 12:00");
  assert.equal(fmtDueShort("2026-09-20T15:00:00Z", TZ, NOW), "ontem 12:00");
});

test("outro dia mostra dia/mês", () => {
  assert.equal(fmtDueShort("2026-09-17T22:43:00Z", TZ, NOW), "17/09 19:43");
});

test("o dia vale no fuso da clínica, não em UTC", () => {
  // 22/09 01:00 UTC ainda é 21/09 22:00 em Belém -> hoje
  assert.equal(fmtDueShort("2026-09-22T01:00:00Z", TZ, NOW), "hoje 22:00");
});

test("nulo e inválido viram traço", () => {
  assert.equal(fmtDueShort(null, TZ, NOW), "—");
  assert.equal(fmtDueShort("lixo", TZ, NOW), "—");
});
