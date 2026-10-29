// tests/evaluation-offer-reply-pure.test.ts
//
// A resposta do responsável pode vir como toque (payload/ListId), número ou
// texto do item. Resposta ambígua tem que virar "invalid" — nunca reservar um
// horário por palpite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInterestReply, parseSlotReply, normalizeReply } from "../lib/evaluation-offer-reply-pure.ts";

const SLOTS = [
  { index: 1, label: "Qui 05/11 às 08:00" },
  { index: 2, label: "Qui 05/11 às 08:50" },
  { index: 3, label: "Qui 05/11 às 09:40" },
];

test("interesse: botão, número e texto", () => {
  assert.deepEqual(parseInterestReply({ body: "Quero agendar", buttonPayload: "eval_yes" }), { kind: "yes" });
  assert.deepEqual(parseInterestReply({ body: "1" }), { kind: "yes" });
  assert.deepEqual(parseInterestReply({ body: "  Sim! " }), { kind: "yes" });
  assert.deepEqual(parseInterestReply({ body: "Agora não" }), { kind: "no" });
  assert.deepEqual(parseInterestReply({ body: "2" }), { kind: "no" });
  assert.deepEqual(parseInterestReply({ body: "PARAR" }), { kind: "stop" });
  assert.deepEqual(parseInterestReply({ body: "qual o endereço?" }), { kind: "invalid" });
});

test("horário: ID do item da lista", () => {
  assert.deepEqual(parseSlotReply({ body: "x", listId: "slot_2" }, SLOTS), { kind: "slot", index: 2 });
  assert.deepEqual(parseSlotReply({ body: "x", listId: "none" }, SLOTS), { kind: "none" });
  assert.deepEqual(parseSlotReply({ body: "x", listId: "human" }, SLOTS), { kind: "human" });
  assert.deepEqual(parseSlotReply({ body: "x", listId: "slot_9" }, SLOTS), { kind: "invalid" });
});

test("horário: número digitado, com 'nenhum serve' e atendente depois dos horários", () => {
  assert.deepEqual(parseSlotReply({ body: "2" }, SLOTS), { kind: "slot", index: 2 });
  assert.deepEqual(parseSlotReply({ body: "4" }, SLOTS), { kind: "none" });
  assert.deepEqual(parseSlotReply({ body: "5" }, SLOTS), { kind: "human" });
  assert.deepEqual(parseSlotReply({ body: "9" }, SLOTS), { kind: "invalid" });
});

test("horário: título do item vindo em Body", () => {
  assert.deepEqual(parseSlotReply({ body: "Qui 05/11 às 08:50" }, SLOTS), { kind: "slot", index: 2 });
  assert.deepEqual(parseSlotReply({ body: "Nenhum serve – ver outros" }, SLOTS), { kind: "none" });
  assert.deepEqual(parseSlotReply({ body: "Falar com atendente" }, SLOTS), { kind: "human" });
});

test("horário: PARAR cancela e texto solto é inválido", () => {
  assert.deepEqual(parseSlotReply({ body: "sair" }, SLOTS), { kind: "stop" });
  assert.deepEqual(parseSlotReply({ body: "pode ser amanhã?" }, SLOTS), { kind: "invalid" });
  assert.deepEqual(parseSlotReply({ body: "" }, SLOTS), { kind: "invalid" });
});

test("lista com 2 horários: o 'nenhum serve' vira 3", () => {
  const two = SLOTS.slice(0, 2);
  assert.deepEqual(parseSlotReply({ body: "3" }, two), { kind: "none" });
  assert.deepEqual(parseSlotReply({ body: "4" }, two), { kind: "human" });
});

test("lembrete: 'Ver horários' reenvia a lista e 'Agora não' encerra", () => {
  assert.deepEqual(parseSlotReply({ body: "Ver horários", buttonPayload: "eval_yes" }, SLOTS), { kind: "resend" });
  assert.deepEqual(parseSlotReply({ body: "Agora não", buttonPayload: "eval_no" }, SLOTS), { kind: "stop" });
});

test("item 'Ver outros horários' da lista vale como 'nenhum serve'", () => {
  assert.deepEqual(parseSlotReply({ body: "Ver outros horários" }, SLOTS), { kind: "none" });
});

test("normalização tira acento, pontuação e caixa", () => {
  assert.equal(normalizeReply("  NÃO!!  "), "nao");
});
