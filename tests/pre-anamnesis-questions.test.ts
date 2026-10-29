// tests/pre-anamnesis-questions.test.ts
//
// O cartão "Respostas da família" só mostra o que a família escreveu, na ordem
// das perguntas; convite sem resposta e recusa aparecem como estado, nunca
// como respostas inventadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrefillView, PRE_ANAMNESIS_QUESTIONS } from "../lib/pre-anamnesis-questions.ts";

const base = { sent_at: "2026-11-04T10:00:00Z", responded_at: null, declined_at: null };

test("respondido: itens na ordem das perguntas, sem vazios", () => {
  const view = buildPrefillView({
    ...base,
    status: "respondido",
    responded_at: "2026-11-04T22:42:00Z",
    structured: { expectativas: " Entender o que ele precisa. ", queixa_principal: "Quase não fala.", alergias: "   " },
  });
  assert.equal(view?.kind, "answered");
  if (view?.kind !== "answered") return;
  assert.deepEqual(view.items, [
    { label: "Queixa principal", value: "Quase não fala." },
    { label: "Expectativas para o 1º atendimento", value: "Entender o que ele precisa." },
  ]);
  assert.equal(view.respondedAt, "2026-11-04T22:42:00Z");
});

test("respondido sem nenhuma resposta legível não vira cartão", () => {
  assert.equal(buildPrefillView({ ...base, status: "respondido", structured: {} }), null);
  assert.equal(buildPrefillView({ ...base, status: "respondido", structured: null }), null);
  assert.equal(buildPrefillView({ ...base, status: "respondido", structured: { queixa_principal: 42 } }), null);
});

test("convite sem resposta e recusa", () => {
  assert.deepEqual(buildPrefillView({ ...base, status: "enviado", structured: null }), { kind: "waiting", sentAt: base.sent_at, reminded: false });
  assert.deepEqual(buildPrefillView({ ...base, status: "lembrete_enviado", structured: null }), { kind: "waiting", sentAt: base.sent_at, reminded: true });
  assert.deepEqual(buildPrefillView({ ...base, status: "recusado", declined_at: "2026-11-04T11:00:00Z", structured: null }), {
    kind: "declined",
    declinedAt: "2026-11-04T11:00:00Z",
  });
});

test("sem linha ou status desconhecido: nada a mostrar", () => {
  assert.equal(buildPrefillView(null), null);
  assert.equal(buildPrefillView({ ...base, status: "outro", structured: null }), null);
});

test("as 5 perguntas têm chave e rótulo únicos", () => {
  assert.equal(PRE_ANAMNESIS_QUESTIONS.length, 5);
  assert.equal(new Set(PRE_ANAMNESIS_QUESTIONS.map((q) => q.key)).size, 5);
  assert.equal(new Set(PRE_ANAMNESIS_QUESTIONS.map((q) => q.label)).size, 5);
});
