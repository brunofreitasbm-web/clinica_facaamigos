// tests/scheduling-promotion-pure.test.ts
//
// Agendar a avaliação só promove o paciente a "avaliacao" quando não há
// autorização pendente na esteira de documentos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldPromoteOnScheduling, computeDraftGate } from "../lib/scheduling-promotion-pure.ts";

test("sem contato na esteira (cadastro presencial): promove", () => {
  assert.equal(shouldPromoteOnScheduling(undefined), true);
});

test("habilitado (plano autorizou, dispensa ou guia ativa): promove", () => {
  assert.equal(shouldPromoteOnScheduling("habilitado"), true);
});

test("ainda esperando guia ou plano: não promove", () => {
  assert.equal(shouldPromoteOnScheduling("aguardando_envio_guia"), false);
  assert.equal(shouldPromoteOnScheduling("aguardando_autorizacao"), false);
  assert.equal(shouldPromoteOnScheduling("aguardando_habilitacao"), false);
});

const base = { guide_sent_at: null, plan_authorized_at: null, authorization_waived: false, scheduling_enabled_at: null, hasActiveAuth: false };

test("docs enviados, guia não enviada: não libera a fila", () => {
  assert.equal(computeDraftGate(base), "aguardando_envio_guia");
});

test("guia enviada: aguardando o plano", () => {
  assert.equal(computeDraftGate({ ...base, guide_sent_at: "2026-11-05" }), "aguardando_autorizacao");
});

test("plano autorizou / dispensa / guia ativa sem clique em Pronto para agendar: NÃO libera", () => {
  assert.equal(computeDraftGate({ ...base, plan_authorized_at: "2026-11-05" }), "aguardando_habilitacao");
  assert.equal(computeDraftGate({ ...base, authorization_waived: true }), "aguardando_habilitacao");
  assert.equal(computeDraftGate({ ...base, hasActiveAuth: true }), "aguardando_habilitacao");
});

test("só o clique em Pronto para agendar (scheduling_enabled_at) libera", () => {
  assert.equal(computeDraftGate({ ...base, scheduling_enabled_at: "2026-11-05" }), "habilitado");
});
