// tests/non-patient-contacts-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNonPatientReason,
  nonPatientDraftRejectReason,
  botDataShowsTherapyIntent,
} from "../lib/non-patient-contacts-pure.ts";

test("buildNonPatientReason usa o rótulo e anexa o detalhe", () => {
  assert.equal(buildNonPatientReason("publicidade"), "Publicidade / propaganda");
  assert.equal(buildNonPatientReason("duvida", "  perguntou endereço "), "Só dúvida / informação: perguntou endereço");
});

test("buildNonPatientReason exige detalhe em 'outro' e recusa valor desconhecido", () => {
  assert.equal(buildNonPatientReason("outro"), null);
  assert.equal(buildNonPatientReason("outro", "   "), null);
  assert.equal(buildNonPatientReason("outro", "golpe"), "Outro: golpe");
  assert.equal(buildNonPatientReason("xyz", "a"), null);
});

test("buildNonPatientReason corta detalhe longo", () => {
  const reason = buildNonPatientReason("engano", "a".repeat(500));
  assert.ok(reason && reason.length <= "Número errado / engano: ".length + 300);
});

test("nonPatientDraftRejectReason tem prefixo fixo", () => {
  assert.equal(nonPatientDraftRejectReason("Publicidade / propaganda"), "Não é paciente: Publicidade / propaganda");
});

test("botDataShowsTherapyIntent só com dado da criança ou carteirinha", () => {
  assert.equal(botDataShowsTherapyIntent(null), false);
  assert.equal(botDataShowsTherapyIntent([]), false);
  assert.equal(botDataShowsTherapyIntent({ guardian_name: "Ana" }), false);
  assert.equal(botDataShowsTherapyIntent({ child_name: "  " }), false);
  assert.equal(botDataShowsTherapyIntent({ child_name: "Léo" }), true);
  assert.equal(botDataShowsTherapyIntent({ card_number: "123" }), true);
  assert.equal(botDataShowsTherapyIntent({ child_birth_date: "2020-01-01" }), true);
});
