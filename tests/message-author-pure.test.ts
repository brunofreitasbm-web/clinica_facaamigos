// tests/message-author-pure.test.ts
//
// Quem enviou cada mensagem do histórico e como mostrar o status de entrega.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryStatusLabel, firstName, messageAuthorLabel } from "../lib/atendimento/message-author-pure.ts";

const staff = { u1: "Maria da Silva Souza", u2: "João Pedro" };
const base = { staffNames: staff, currentUserId: "u2" };

test("mensagem recebida do contato não tem autor", () => {
  assert.equal(messageAuthorLabel({ ...base, direction: "inbound", senderType: "user" }), null);
});

test("atendente: primeiro nome, ou 'Você' quando é o próprio operador", () => {
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "agent", sentBy: "u1" }), "Maria");
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "agent", sentBy: "u2" }), "Você");
});

test("atendente de mensagem antiga (sem sent_by): 'Equipe'", () => {
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "agent" }), "Equipe");
});

test("bot de verdade: 'Bot'", () => {
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "bot", intent: "faq_local" }), "Bot");
});

test("menu enviado pela recepção (gravado como bot, com sent_by): mostra quem enviou", () => {
  assert.equal(
    messageAuthorLabel({ ...base, direction: "outbound", senderType: "bot", intent: "menu_inicial", sentBy: "u1" }),
    "Menu enviado por Maria",
  );
  assert.equal(
    messageAuthorLabel({ ...base, direction: "outbound", senderType: "bot", intent: "menu_inicial", sentBy: "u2" }),
    "Menu enviado por você",
  );
});

test("sent_by de pessoa que saiu da equipe (nome desconhecido) não quebra", () => {
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "agent", sentBy: "u9" }), "Equipe");
  assert.equal(
    messageAuthorLabel({ ...base, direction: "outbound", senderType: "bot", intent: "menu_inicial", sentBy: "u9" }),
    "Menu enviado pela equipe",
  );
});

test("sistema e automação: 'Automático'", () => {
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "system" }), "Automático");
  assert.equal(messageAuthorLabel({ ...base, direction: "outbound", senderType: "automation" }), "Automático");
});

test("firstName tolera vazio e espaços", () => {
  assert.equal(firstName("  Ana  Paula "), "Ana");
  assert.equal(firstName(""), null);
  assert.equal(firstName(null), null);
  assert.equal(firstName(undefined), null);
});

test("status de entrega em português, nunca o código em inglês", () => {
  assert.deepEqual(deliveryStatusLabel("queued"), { label: "Enviando", tone: "pending" });
  assert.deepEqual(deliveryStatusLabel("sending"), { label: "Enviando", tone: "pending" });
  assert.deepEqual(deliveryStatusLabel("sent"), { label: "Enviado", tone: "sent" });
  assert.deepEqual(deliveryStatusLabel("delivered"), { label: "Entregue", tone: "delivered" });
  assert.deepEqual(deliveryStatusLabel("read"), { label: "Lido", tone: "read" });
  assert.deepEqual(deliveryStatusLabel("failed"), { label: "Falhou no envio", tone: "failed" });
  assert.deepEqual(deliveryStatusLabel("undelivered"), { label: "Falhou no envio", tone: "failed" });
});

test("sem status: nada a mostrar; status desconhecido não é escondido", () => {
  assert.equal(deliveryStatusLabel(null), null);
  assert.equal(deliveryStatusLabel(undefined), null);
  assert.equal(deliveryStatusLabel(""), null);
  assert.deepEqual(deliveryStatusLabel("weird"), { label: "weird", tone: "pending" });
});
