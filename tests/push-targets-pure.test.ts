// tests/push-targets-pure.test.ts
//
// Quem é avisado por push quando chega mensagem no Atendimento.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldNotify, selectPushUserIds } from "../lib/atendimento/push-targets.ts";

const now = new Date("2026-10-18T12:00:00Z");

test("bot cuidando da conversa não gera push", () => {
  assert.equal(shouldNotify({ botActive: true, botEnabled: true, lastPushAt: null, now }), false);
});

test("humano na conversa ou bot geral desligado geram push", () => {
  assert.equal(shouldNotify({ botActive: false, botEnabled: true, lastPushAt: null, now }), true);
  assert.equal(shouldNotify({ botActive: true, botEnabled: false, lastPushAt: null, now }), true);
});

test("debounce de 3 minutos por conversa", () => {
  assert.equal(shouldNotify({ botActive: false, botEnabled: true, lastPushAt: "2026-10-18T11:58:00Z", now }), false);
  assert.equal(shouldNotify({ botActive: false, botEnabled: true, lastPushAt: "2026-10-18T11:56:00Z", now }), true);
});

test("atribuída avisa só o responsável; sem aparelho dele, avisa todos", () => {
  assert.deepEqual(selectPushUserIds({ assignedTo: "b", subscribedUserIds: ["a", "b", "b"] }), ["b"]);
  assert.deepEqual(selectPushUserIds({ assignedTo: "x", subscribedUserIds: ["a", "b", "a"] }), ["a", "b"]);
  assert.deepEqual(selectPushUserIds({ assignedTo: null, subscribedUserIds: [] }), []);
});
