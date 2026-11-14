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

import { formatBadgeCount } from "../lib/chat-fab-pure.ts";
import { countWaiting } from "../lib/atendimento/waiting.ts";

test("balão limita em 99+", () => {
  assert.equal(formatBadgeCount(9), "9");
  assert.equal(formatBadgeCount(99), "99");
  assert.equal(formatBadgeCount(100), "99+");
});

test("countWaiting: só conta quem espera resposta e cai quando alguém responde", () => {
  const row = (status: string, sender: string | null) => ({
    status,
    last_message_sender: sender,
    last_inbound_at: "2026-11-14T10:00:00Z",
    last_message_at: "2026-11-14T10:00:00Z",
  });
  const rows = [row("open", "contact"), row("open", "contact"), row("pending", "bot"), row("open", "agent"), row("closed", "contact")];
  assert.equal(countWaiting(rows), 3);
  // alguém da equipe responde a primeira: 3 -> 2
  rows[0] = row("open", "agent");
  assert.equal(countWaiting(rows), 2);
  assert.equal(countWaiting([]), 0);
});
