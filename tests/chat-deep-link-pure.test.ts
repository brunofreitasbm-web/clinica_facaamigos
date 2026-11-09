// tests/chat-deep-link-pure.test.ts
//
// Link direto para uma conversa: /recepcao/atendimento?c=<id> ou ?tel=<telefone>.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatHref, resolveInitialConversationId } from "../lib/atendimento/chat-deep-link-pure.ts";

const rows = [
  { id: "a", phoneNumber: "+5591988470999" },
  { id: "b", phoneNumber: "+5511999990000" },
  { id: "c", phoneNumber: "+5591988470999" },
];

test("?c= escolhe a conversa pelo id", () => {
  assert.equal(resolveInitialConversationId(rows, { c: "b" }), "b");
});

test("?c= inexistente cai no telefone, depois em nada", () => {
  assert.equal(resolveInitialConversationId(rows, { c: "zzz", tel: "+5511999990000" }), "b");
  assert.equal(resolveInitialConversationId(rows, { c: "zzz" }), null);
});

test("?tel= ignora formatação e prefixo 55", () => {
  assert.equal(resolveInitialConversationId(rows, { tel: "(11) 99999-0000" }), "b");
  assert.equal(resolveInitialConversationId(rows, { tel: "5511999990000" }), "b");
  assert.equal(resolveInitialConversationId(rows, { tel: "+55 11 99999-0000" }), "b");
});

test("telefone com mais de uma conversa: a primeira da lista (a mais recente)", () => {
  assert.equal(resolveInitialConversationId(rows, { tel: "+5591988470999" }), "a");
});

test("número curto demais não casa por engano", () => {
  assert.equal(resolveInitialConversationId(rows, { tel: "999" }), null);
  assert.equal(resolveInitialConversationId(rows, { tel: "" }), null);
});

test("sem parâmetros ou valores em lista (?c=a&c=b): usa o primeiro, sem quebrar", () => {
  assert.equal(resolveInitialConversationId(rows, {}), null);
  assert.equal(resolveInitialConversationId(rows, { c: ["b", "a"] }), "b");
  assert.equal(resolveInitialConversationId(rows, { c: undefined, tel: undefined }), null);
});

test("chatHref monta o link por telefone (o que Autorizações tem) ou por id", () => {
  assert.equal(chatHref({ phone: "+5591988470999" }), "/recepcao/atendimento?tel=%2B5591988470999");
  assert.equal(chatHref({ conversationId: "abc" }), "/recepcao/atendimento?c=abc");
  assert.equal(chatHref({ conversationId: "abc", phone: "+55" }), "/recepcao/atendimento?c=abc");
  assert.equal(chatHref({}), "/recepcao/atendimento");
});
