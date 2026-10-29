// tests/chat-format.test.ts
//
// Helpers do chat mobile estilo WhatsApp (lib/atendimento/chat-format.ts) e a
// regra da janela de 24h (lib/atendimento/whatsapp-window.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildChatItems,
  formatDayLabel,
  formatListTimestamp,
  hasEchoedMessage,
} from "../lib/atendimento/chat-format.ts";
import { isWhatsappWindowClosed } from "../lib/atendimento/whatsapp-window.ts";

const TZ = "America/Belem"; // UTC-3, sem horário de verão
const NOW = new Date("2026-10-27T15:00:00Z"); // 27/10 12:00 em Belém

test("formatDayLabel: hoje, ontem e data por extenso", () => {
  assert.equal(formatDayLabel("2026-10-27T13:00:00Z", NOW, TZ), "Hoje");
  assert.equal(formatDayLabel("2026-10-26T20:00:00Z", NOW, TZ), "Ontem");
  assert.equal(formatDayLabel("2026-10-12T20:00:00Z", NOW, TZ), "12 de outubro");
  assert.equal(formatDayLabel("2025-03-05T20:00:00Z", NOW, TZ), "5 de março de 2025");
});

test("formatDayLabel: usa o dia do fuso, não o UTC (01:00Z de 27/10 ainda é 26/10 em Belém)", () => {
  assert.equal(formatDayLabel("2026-10-27T01:00:00Z", NOW, TZ), "Ontem");
});

test("formatListTimestamp: hora hoje, Ontem, dia da semana e dd/mm/aa", () => {
  assert.equal(formatListTimestamp("2026-10-27T13:05:00Z", NOW, TZ), "10:05");
  assert.equal(formatListTimestamp("2026-10-26T20:00:00Z", NOW, TZ), "Ontem");
  assert.equal(formatListTimestamp("2026-10-23T20:00:00Z", NOW, TZ), "sexta");
  assert.equal(formatListTimestamp("2026-09-01T20:00:00Z", NOW, TZ), "01/09/26");
  assert.equal(formatListTimestamp(null, NOW, TZ), "");
});

const msg = (id: string, direction: string, senderType: string, sentAt: string | null) => ({
  id,
  direction,
  senderType,
  sentAt,
});

test("buildChatItems: separador por dia e cauda só no início da sequência", () => {
  const items = buildChatItems(
    [
      msg("a", "inbound", "user", "2026-10-26T20:00:00Z"),
      msg("b", "inbound", "user", "2026-10-26T20:01:00Z"),
      msg("c", "outbound", "agent", "2026-10-26T20:02:00Z"),
      msg("d", "outbound", "bot", "2026-10-26T20:03:00Z"),
      msg("e", "inbound", "user", "2026-10-27T13:00:00Z"),
    ],
    NOW,
    TZ,
  );
  assert.deepEqual(
    items.map((i) => (i.kind === "day" ? `day:${i.label}` : `${i.key}:${i.groupStart}`)),
    ["day:Ontem", "a:true", "b:false", "c:true", "d:true", "day:Hoje", "e:true"],
  );
});

test("buildChatItems: mensagem sem data não gera separador e não quebra", () => {
  const items = buildChatItems([msg("a", "outbound", "agent", null), msg("b", "outbound", "agent", null)], NOW, TZ);
  assert.deepEqual(
    items.map((i) => (i.kind === "day" ? "day" : `${i.key}:${i.groupStart}`)),
    ["a:true", "b:false"],
  );
});

test("hasEchoedMessage: reconhece o eco do envio otimista pelo texto", () => {
  const createdAt = new Date("2026-10-27T15:00:00Z").getTime();
  const persisted = [{ direction: "outbound", body: " Olá! ", sentAt: "2026-10-27T15:00:02Z" }];
  assert.equal(hasEchoedMessage(persisted, { body: "Olá!", createdAt }), true);
  assert.equal(hasEchoedMessage(persisted, { body: "Outra", createdAt }), false);
  assert.equal(
    hasEchoedMessage([{ direction: "inbound", body: "Olá!", sentAt: "2026-10-27T15:00:02Z" }], { body: "Olá!", createdAt }),
    false,
  );
  // linha "failed" com o mesmo texto não é eco (reenvio)
  assert.equal(
    hasEchoedMessage([{ direction: "outbound", body: "Olá!", sentAt: "2026-10-27T15:00:02Z", deliveryStatus: "failed" }], {
      body: "Olá!",
      createdAt,
    }),
    false,
  );
  // mesma frase enviada horas antes não conta como eco
  assert.equal(
    hasEchoedMessage([{ direction: "outbound", body: "Olá!", sentAt: "2026-10-27T10:00:00Z" }], { body: "Olá!", createdAt }),
    false,
  );
});

test("isWhatsappWindowClosed: 24h exatas e contato sem inbound", () => {
  const now = Date.parse("2026-10-27T15:00:00Z");
  assert.equal(isWhatsappWindowClosed({ lastInboundAt: null }, now), true);
  assert.equal(isWhatsappWindowClosed({ lastInboundAt: "2026-10-26T15:00:01Z" }, now), false);
  assert.equal(isWhatsappWindowClosed({ lastInboundAt: "2026-10-26T14:59:59Z" }, now), true);
});
