// tests/menu-reset-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MENU_RESET_WINDOW_MS, isInactiveForMenuReset, shouldDiscardSession } from "../lib/menu-reset-pure.ts";

const NOW = Date.parse("2026-11-01T00:58:35Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const H = 60 * 60 * 1000;

test("janela padrão é de 48 horas", () => {
  assert.equal(MENU_RESET_WINDOW_MS, 48 * H);
});

test("1 mês sem escrever (caso do +559188470999) reinicia o menu", () => {
  assert.equal(isInactiveForMenuReset("2026-09-13T03:36:32Z", NOW), true);
});

test("47h59 não reinicia; 48h01 reinicia", () => {
  assert.equal(isInactiveForMenuReset(ago(48 * H - 60_000), NOW), false);
  assert.equal(isInactiveForMenuReset(ago(48 * H + 60_000), NOW), true);
});

test("sem mensagem anterior (primeiro contato) ou data inválida não reinicia", () => {
  assert.equal(isInactiveForMenuReset(null, NOW), false);
  assert.equal(isInactiveForMenuReset(undefined, NOW), false);
  assert.equal(isInactiveForMenuReset("lixo", NOW), false);
});

test("sessão esquecida do AGENDAR é descartada", () => {
  assert.equal(shouldDiscardSession({ current_step: "awaiting_has_laudo", flow: null }), true);
  assert.equal(shouldDiscardSession({ current_step: "pre_anamnesis_consent", flow: null }), true);
  assert.equal(shouldDiscardSession({ current_step: "intake_awaiting_documents", flow: null }), true);
  assert.equal(shouldDiscardSession({ current_step: "absence_awaiting_choice", flow: null }), true);
});

test("sem sessão, idle ou completed: nada a descartar", () => {
  assert.equal(shouldDiscardSession(null), false);
  assert.equal(shouldDiscardSession({ current_step: "idle", flow: null }), false);
  assert.equal(shouldDiscardSession({ current_step: "completed", flow: null }), false);
  assert.equal(shouldDiscardSession({ current_step: "", flow: null }), false);
});

test("oferta de horários da 1ª avaliação e etapa da supervisão nunca são descartadas", () => {
  assert.equal(shouldDiscardSession({ current_step: "awaiting_slot_choice", flow: "eval_offer" }), false);
  assert.equal(shouldDiscardSession({ current_step: "intake_pending_supervisor", flow: null }), false);
});
