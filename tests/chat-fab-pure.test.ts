// Botão flutuante do chat: quem vê e onde.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowChatFab } from "../lib/chat-fab-pure.ts";

test("gestor, supervisão e recepção veem o botão", () => {
  for (const role of ["gestor", "supervisor", "recepcao"]) {
    assert.equal(shouldShowChatFab(role, "/recepcao/agenda"), true, role);
  }
  assert.equal(shouldShowChatFab("gestor", "/gestor/inteligencia"), true);
});

test("terapeuta e família não veem", () => {
  assert.equal(shouldShowChatFab("terapeuta", "/terapeuta"), false);
  assert.equal(shouldShowChatFab("responsavel", "/familia"), false);
});

test("faturamento não vê (o guard redirecionaria para a home)", () => {
  assert.equal(shouldShowChatFab("faturamento", "/faturamento"), false);
});

test("sem login ou papel desconhecido: não aparece", () => {
  assert.equal(shouldShowChatFab(null, "/login"), false);
  assert.equal(shouldShowChatFab(undefined, "/assinar/x"), false);
  assert.equal(shouldShowChatFab("outro", "/recepcao"), false);
});

test("não aparece nas telas do próprio chat", () => {
  assert.equal(shouldShowChatFab("recepcao", "/recepcao/atendimento"), false);
  assert.equal(shouldShowChatFab("recepcao", "/recepcao/atendimento/chatbot"), false);
  assert.equal(shouldShowChatFab("recepcao", "/m/atendimento/123"), false);
  assert.equal(shouldShowChatFab("recepcao", "/recepcao/atendimentos-x"), true);
});
