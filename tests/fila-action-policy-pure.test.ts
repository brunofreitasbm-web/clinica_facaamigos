// tests/fila-action-policy-pure.test.ts
//
// Política das ações da Fila: quem manda WhatsApp pede conferência e não tem Desfazer; o resto vai direto
// com Desfazer de 8 s.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FILA_ACTION_POLICY, actionConfirms, actionOffersUndo, guideConfirmSummary } from "../lib/fila/fila-action-policy-pure.ts";

test("quem manda WhatsApp pede confirmação e não tem desfazer; o resto tem desfazer sem confirmação", () => {
  for (const [key, p] of Object.entries(FILA_ACTION_POLICY)) {
    if (p.sendsWhatsApp) assert.deepEqual([p.confirm, p.undo], [true, false], key);
    else assert.deepEqual([p.confirm, p.undo], [false, true], key);
  }
});

test("habilitar e plano autorizou contam como envio de WhatsApp (oferta de horários)", () => {
  assert.equal(FILA_ACTION_POLICY.enable_scheduling.sendsWhatsApp, true);
  assert.equal(FILA_ACTION_POLICY.authorize_and_enable.sendsWhatsApp, true);
});

test("as ações que mandam WhatsApp são exatamente as seis da regra", () => {
  const whatsapp = Object.entries(FILA_ACTION_POLICY)
    .filter(([, p]) => p.sendsWhatsApp)
    .map(([key]) => key)
    .sort();
  assert.deepEqual(whatsapp, ["ask_documents", "authorize_and_enable", "enable_scheduling", "more_docs_request", "opener", "remind"]);
});

test("as ações reversíveis da Fila têm Desfazer", () => {
  for (const key of ["guide_sent", "guide_not_sent", "waive", "plan_denied", "plan_more_docs"] as const) {
    assert.equal(actionOffersUndo(key), true, key);
    assert.equal(actionConfirms(key), false, key);
  }
  assert.equal(actionOffersUndo("authorize_and_enable"), false);
  assert.equal(actionConfirms("authorize_and_enable"), true);
});

test("resumo da guia na confirmação: número e validade, sem texto solto quando falta a validade", () => {
  assert.equal(guideConfirmSummary({ guideNumber: "123", validTo: "2026-12-31" }), "Guia 123, válida até 31/12/2026.");
  assert.equal(guideConfirmSummary({ guideNumber: "123", validTo: "" }), "Guia 123.");
  assert.equal(guideConfirmSummary({ guideNumber: "  ", validTo: "" }), "Guia sem número.");
  assert.equal(guideConfirmSummary({ guideNumber: "", validTo: "  " }), "Guia sem número.");
  assert.equal(guideConfirmSummary({ guideNumber: "9", validTo: "31/12/2026" }), "Guia 9, válida até 31/12/2026.");
});
