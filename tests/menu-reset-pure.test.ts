// tests/menu-reset-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MENU_RESET_WINDOW_MS,
  decideMenuReset,
  isInactiveForMenuReset,
  shouldDiscardSession,
} from "../lib/menu-reset-pure.ts";

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

// ---------------------------------------------------------------------------
// decideMenuReset: o reinício de 48h não pode engolir a resposta a um template.
// Caso real (09/11): 8 de 10 famílias que tocaram "Quero agendar" no aviso de
// plano autorizado receberam o menu de boas-vindas em vez dos horários.
// ---------------------------------------------------------------------------
const base = {
  previousInboundAt: ago(45 * 24 * H),
  lastClinicOutboundAt: null as string | null,
  hasInteractiveReply: false,
  session: null as { current_step: string | null; flow: string | null } | null,
  sessionUpdatedAt: null as string | null,
  nowMs: NOW,
};

test("toque em botão depois de 45 dias NÃO manda menu nem descarta sessão", () => {
  const d = decideMenuReset({
    ...base,
    hasInteractiveReply: true,
    lastClinicOutboundAt: ago(2 * 60_000),
    session: { current_step: "pre_anamnesis_consent", flow: null },
    sessionUpdatedAt: ago(2 * 60_000),
  });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("botão sem nenhum envio recente da clínica também é respeitado", () => {
  const d = decideMenuReset({ ...base, hasInteractiveReply: true });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("texto livre logo depois de um template da clínica (há 10 min) não manda menu", () => {
  const d = decideMenuReset({ ...base, lastClinicOutboundAt: ago(10 * 60_000) });
  assert.equal(d.sendMenu, false);
});

test("clínica falou depois do contato, mas há mais de 48h: o menu volta", () => {
  const d = decideMenuReset({ ...base, lastClinicOutboundAt: ago(49 * H) });
  assert.equal(d.sendMenu, true);
});

test("resposta a template não descarta a sessão recém-aberta pelo template", () => {
  const d = decideMenuReset({
    ...base,
    lastClinicOutboundAt: ago(5 * 60_000),
    session: { current_step: "pre_anamnesis_consent", flow: null },
    sessionUpdatedAt: ago(5 * 60_000),
  });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("sessão esquecida há 6 semanas + 'Oi' continua reiniciando (motivo original da regra)", () => {
  const d = decideMenuReset({
    ...base,
    session: { current_step: "awaiting_has_laudo", flow: null },
    sessionUpdatedAt: ago(42 * 24 * H),
  });
  assert.deepEqual(d, { sendMenu: true, discardSession: true });
});

test("sessão da oferta de horários (eval_offer) é preservada e não gera menu", () => {
  const d = decideMenuReset({
    ...base,
    session: { current_step: "eval_offer_awaiting_choice", flow: "eval_offer" },
    sessionUpdatedAt: ago(3 * 24 * H),
  });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("etapa da supervisão (intake_pending_supervisor) é preservada e não gera menu", () => {
  const d = decideMenuReset({
    ...base,
    session: { current_step: "intake_pending_supervisor", flow: null },
    sessionUpdatedAt: ago(3 * 24 * H),
  });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("primeiro contato (sem mensagem anterior) não reinicia", () => {
  const d = decideMenuReset({ ...base, previousInboundAt: null });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("dentro de 48h de conversa ativa não reinicia", () => {
  const d = decideMenuReset({ ...base, previousInboundAt: ago(3 * H) });
  assert.deepEqual(d, { sendMenu: false, discardSession: false });
});

test("sessão sem data de atualização é tratada como velha (descarta como antes)", () => {
  const d = decideMenuReset({ ...base, session: { current_step: "awaiting_plan", flow: null }, sessionUpdatedAt: null });
  assert.deepEqual(d, { sendMenu: true, discardSession: true });
});
