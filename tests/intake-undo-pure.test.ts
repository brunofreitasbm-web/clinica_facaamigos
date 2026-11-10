// tests/intake-undo-pure.test.ts
//
// Desfazer da Fila de entrada: guarda o estado de antes e só restaura se o caso ainda está como a ação deixou.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUndoToken,
  decideRestore,
  sameValue,
  shouldRestorePatient,
  validateUndoToken,
  type DraftStateRow,
} from "../lib/intake-undo-pure.ts";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";
const AUTH = "44444444-4444-4444-8444-444444444444";

const row = (over: Partial<DraftStateRow> = {}): DraftStateRow => ({
  guide_sent_at: null,
  guide_sent_by: null,
  plan_authorized_at: null,
  plan_authorized_by: null,
  authorization_waived: false,
  authorized_guide: null,
  authorization_id: null,
  scheduling_enabled_at: null,
  scheduling_enabled_by: null,
  returned_to_reception_at: null,
  returned_to_reception_by: null,
  returned_to_reception_reason: null,
  plan_denied_at: null,
  plan_more_docs_at: null,
  ...over,
});

test("sameValue: datas pelo instante, ilegível nunca é igual, nulos iguais", () => {
  assert.equal(sameValue("guide_sent_at", "2026-11-10T12:00:00.000Z", "2026-11-10T12:00:00+00:00"), true);
  assert.equal(sameValue("guide_sent_at", "lixo", "lixo"), false);
  assert.equal(sameValue("guide_sent_at", null, undefined), true);
  assert.equal(sameValue("guide_sent_at", null, "2026-11-10T12:00:00Z"), false);
  assert.equal(sameValue("authorized_guide", { a: 1 }, { a: 1 }), true);
});

test("guia enviada: desfazer restaura o envio anterior (inclusive um envio antigo)", () => {
  const before = row({ guide_sent_at: null });
  const after = row({ guide_sent_at: "2026-11-10T12:00:00+00:00", guide_sent_by: U1 });
  const token = buildUndoToken("guide_sent", before, after);
  assert.ok(token);
  assert.deepEqual(token.previous, { guide_sent_at: null, guide_sent_by: null });
  const d = decideRestore(token, after);
  assert.deepEqual(d, { ok: true, update: { guide_sent_at: null, guide_sent_by: null } });
});

test("compare-and-set: caso mudou depois da ação, nada é desfeito", () => {
  const after = row({ guide_sent_at: "2026-11-10T12:00:00Z", guide_sent_by: U1 });
  const token = buildUndoToken("guide_sent", row(), after);
  assert.ok(token);
  // outra pessoa registrou a autorização
  assert.deepEqual(decideRestore(token, { ...after, plan_authorized_at: "2026-11-10T12:05:00Z" }), { ok: false, reason: "changed" });
  // guia marcada de novo (outro instante)
  assert.deepEqual(decideRestore(token, { ...after, guide_sent_at: "2026-11-10T12:06:00Z" }), { ok: false, reason: "changed" });
});

test("retirar habilitação: desfazer volta a data e quem habilitou, sem depender da oferta", () => {
  const before = row({ plan_authorized_at: "2026-11-09T10:00:00Z", scheduling_enabled_at: "2026-11-09T11:00:00Z", scheduling_enabled_by: U2 });
  const after = { ...before, scheduling_enabled_at: null, scheduling_enabled_by: null };
  const token = buildUndoToken("scheduling", before, after);
  assert.ok(token);
  const d = decideRestore(token, after);
  assert.ok(d.ok);
  assert.equal(d.ok && d.update.scheduling_enabled_at, "2026-11-09T11:00:00Z");
  assert.equal(d.ok && d.update.scheduling_enabled_by, U2);
});

test("habilitar caso devolvido: desfazer devolve também a devolução da Supervisão", () => {
  const before = row({
    authorization_waived: true,
    returned_to_reception_at: "2026-11-08T10:00:00Z",
    returned_to_reception_by: U2,
    returned_to_reception_reason: "Tem plano",
  });
  const after = { ...before, scheduling_enabled_at: "2026-11-10T12:00:00Z", scheduling_enabled_by: U1, returned_to_reception_at: null, returned_to_reception_by: null, returned_to_reception_reason: null };
  const token = buildUndoToken("scheduling", before, after);
  assert.ok(token);
  const d = decideRestore(token, after);
  assert.ok(d.ok);
  assert.equal(d.ok && d.update.returned_to_reception_reason, "Tem plano");
  assert.equal(d.ok && d.update.returned_to_reception_at, "2026-11-08T10:00:00Z");
  assert.equal(d.ok && d.update.scheduling_enabled_at, null);
});

test("guia autorizada gravada no prontuário não tem desfazer", () => {
  const before = row({ guide_sent_at: "2026-11-05T10:00:00Z" });
  const after = { ...before, plan_authorized_at: "2026-11-10T12:00:00Z", authorization_id: AUTH, scheduling_enabled_at: "2026-11-10T12:00:01Z" };
  assert.equal(buildUndoToken("authorization", before, after), null);
  const kept = { ...after, authorization_id: null, authorized_guide: { guide_number: "1" } };
  const token = buildUndoToken("authorization", before, kept);
  assert.ok(token);
  const d = decideRestore(token, kept);
  assert.ok(d.ok);
  assert.equal(d.ok && d.update.plan_authorized_at, null);
  assert.equal(d.ok && d.update.scheduling_enabled_at, null);
  assert.equal(d.ok && d.update.authorized_guide, null);
});

test("particular: promoção automática do paciente volta só se o status ainda é o promovido", () => {
  const before = row();
  const after = row({ authorization_waived: true });
  const token = buildUndoToken("waive", before, after, { id: P, before: "interessado", after: "avaliacao" });
  assert.ok(token);
  assert.deepEqual(token.patient, { id: P, previous: "interessado", applied: "avaliacao" });
  assert.equal(shouldRestorePatient(token, "avaliacao"), true);
  assert.equal(shouldRestorePatient(token, "ativo"), false);
  // sem promoção (já era avaliacao), não mexe no paciente
  const none = buildUndoToken("waive", before, after, { id: P, before: "avaliacao", after: "avaliacao" });
  assert.equal(none?.patient, null);
});

test("nada mudou: sem desfazer", () => {
  assert.equal(buildUndoToken("guide_sent", row(), row()), null);
});

test("validateUndoToken: aceita o que buildUndoToken monta e recusa colunas a mais ou valores errados", () => {
  const after = row({ guide_sent_at: "2026-11-10T12:00:00Z", guide_sent_by: U1 });
  const token = buildUndoToken("guide_sent", row(), after);
  assert.ok(token);
  const roundTrip = JSON.parse(JSON.stringify(token));
  assert.deepEqual(validateUndoToken(roundTrip), token);
  assert.equal(validateUndoToken({ ...roundTrip, kind: "outro" }), null);
  assert.equal(validateUndoToken({ ...roundTrip, previous: { ...roundTrip.previous, plan_authorized_at: null } }), null);
  assert.equal(validateUndoToken({ ...roundTrip, previous: { ...roundTrip.previous, guide_sent_by: "não é uuid" } }), null);
  assert.equal(validateUndoToken({ ...roundTrip, patient: { id: P, previous: "ativo", applied: "avaliacao" } }), null);
  const auth = buildUndoToken("authorization", row(), row({ plan_authorized_at: "2026-11-10T12:00:00Z" }));
  assert.ok(auth);
  const forged = JSON.parse(JSON.stringify(auth));
  forged.previous.authorization_id = AUTH;
  assert.equal(validateUndoToken(forged), null);
});
