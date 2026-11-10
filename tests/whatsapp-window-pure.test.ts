// tests/whatsapp-window-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WHATSAPP_AUTOMATION_WINDOW_MS,
  WHATSAPP_SERVICE_WINDOW_MS,
  isWindowClosed,
  windowClosingLabel,
  windowRemainingMs,
} from "../lib/whatsapp-window-pure.ts";

const NOW = Date.parse("2026-11-09T20:00:00Z");
const MIN = 60_000;
const H = 60 * MIN;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test("janela real é 24h e a do disparo automático tem 1h de margem", () => {
  assert.equal(WHATSAPP_SERVICE_WINDOW_MS, 24 * H);
  assert.equal(WHATSAPP_AUTOMATION_WINDOW_MS, 23 * H);
});

test("sem mensagem recebida ou data inválida: janela fechada", () => {
  assert.equal(isWindowClosed(null, NOW), true);
  assert.equal(isWindowClosed(undefined, NOW), true);
  assert.equal(isWindowClosed("lixo", NOW), true);
});

test("23h59 aberta; 24h01 fechada", () => {
  assert.equal(isWindowClosed(ago(24 * H - MIN), NOW), false);
  assert.equal(isWindowClosed(ago(24 * H + MIN), NOW), true);
});

test("o caso real: conversa muda há 45 dias está fechada", () => {
  assert.equal(isWindowClosed(ago(45 * 24 * H), NOW), true);
});

test("tempo restante nunca é negativo", () => {
  assert.equal(windowRemainingMs(ago(30 * H), NOW), 0);
  assert.equal(windowRemainingMs(ago(23 * H), NOW), 1 * H);
});

test("aviso de fechamento só nas últimas 2h", () => {
  assert.equal(windowClosingLabel(ago(10 * H), NOW), null);
  assert.equal(windowClosingLabel(ago(21 * H + 59 * MIN), NOW), null);
  assert.equal(windowClosingLabel(ago(22 * H + 40 * MIN), NOW), "1h20");
  assert.equal(windowClosingLabel(ago(23 * H + 15 * MIN), NOW), "45 min");
  assert.equal(windowClosingLabel(ago(22 * H), NOW), "2h");
});

test("sem aviso quando já fechou ou nunca abriu", () => {
  assert.equal(windowClosingLabel(ago(25 * H), NOW), null);
  assert.equal(windowClosingLabel(null, NOW), null);
});
