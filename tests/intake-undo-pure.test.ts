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
const T1 = "2026-11-10T12:00:00Z";
const T2 = "2026-11-10T12:05:00Z";
const T3 = "2026-11-10T12:10:00Z";

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
  plan_denied_by: null,
  plan_more_docs_by: null,
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
});

test("plano negou: desfazer devolve a guia enviada e a negativa anterior", () => {
  const before = row({ guide_sent_at: T1, guide_sent_by: U1, plan_denied_at: null, plan_denied_by: null });
  const after = row({ guide_sent_at: null, guide_sent_by: null, plan_denied_at: T2, plan_denied_by: U2 });
  const token = buildUndoToken("plan_denied", before, after)!;
  assert.deepEqual(token.previous, { plan_denied_at: null, plan_denied_by: null, guide_sent_at: T1, guide_sent_by: U1 });
  assert.deepEqual(decideRestore(token, after), { ok: true, update: token.previous });
  assert.deepEqual(decideRestore(token, { ...after, guide_sent_at: T3 }), { ok: false, reason: "changed" });
});

test("plano pediu mais documentos: desfazer devolve a guia enviada e o pedido anterior", () => {
  const before = row({ guide_sent_at: T1, guide_sent_by: U1, plan_more_docs_at: null, plan_more_docs_by: null });
  const after = row({ guide_sent_at: null, guide_sent_by: null, plan_more_docs_at: T2, plan_more_docs_by: U2 });
  const token = buildUndoToken("plan_more_docs", before, after)!;
  assert.deepEqual(token.previous, { plan_more_docs_at: null, plan_more_docs_by: null, guide_sent_at: T1, guide_sent_by: U1 });
  assert.deepEqual(decideRestore(token, after), { ok: true, update: token.previous });
  assert.deepEqual(decideRestore(token, { ...after, plan_authorized_at: T3 }), { ok: false, reason: "changed" });
  const round = JSON.parse(JSON.stringify(token));
  assert.deepEqual(validateUndoToken(round), token);
});

test("validateUndoToken recusa os tipos que mandam WhatsApp", () => {
  for (const kind of ["scheduling", "authorization"]) assert.equal(validateUndoToken({ kind, previous: {}, applied: {}, patient: null }), null);
});
