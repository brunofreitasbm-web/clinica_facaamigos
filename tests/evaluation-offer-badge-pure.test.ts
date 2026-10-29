// tests/evaluation-offer-badge-pure.test.ts
//
// A faixa do card diz à supervisão em que passo o responsável está. Só ofertas
// vivas (convite/escolha) avisam que agendar manual cancela o fluxo automático.
import { test } from "node:test";
import assert from "node:assert/strict";
import { offerBadge, type PoolOffer } from "../lib/evaluation-offer-badge-pure.ts";

const SENT = "2026-10-29T12:00:00.000Z";
const at = (hoursAfterSent: number) => Date.parse(SENT) + hoursAfterSent * 3_600_000;
const offer = (over: Partial<PoolOffer>): PoolOffer => ({
  id: "o1",
  status: "aguardando_interesse",
  sentAt: SENT,
  reminderSentAt: null,
  lastError: null,
  ...over,
});

test("convite sem resposta: âmbar, viva, com tempo e prazo", () => {
  const b = offerBadge(offer({}), at(5));
  assert.equal(b.tone, "amber");
  assert.equal(b.live, true);
  assert.equal(b.detail, "há 5 h · expira em 43 h");
});

test("escolhendo o horário: azul e viva", () => {
  const b = offerBadge(offer({ status: "aguardando_escolha" }), at(1));
  assert.equal(b.tone, "blue");
  assert.equal(b.live, true);
});

test("lembrete enviado aparece no detalhe", () => {
  assert.match(offerBadge(offer({ reminderSentAt: SENT }), at(25)).detail, /lembrete enviado/);
});

test("passou do prazo: 'expirando', nunca horas negativas", () => {
  assert.match(offerBadge(offer({}), at(49)).detail, /expirando/);
});

test("falha: vermelha, não viva, mostra o motivo", () => {
  const b = offerBadge(offer({ status: "falhou", lastError: "Responsável sem telefone cadastrado." }), at(1));
  assert.equal(b.tone, "red");
  assert.equal(b.live, false);
  assert.equal(b.detail, "Responsável sem telefone cadastrado.");
});

test("sem horário livre: vermelha com título próprio", () => {
  assert.equal(offerBadge(offer({ status: "sem_horario" }), at(1)).title, "Sem horário livre");
});
