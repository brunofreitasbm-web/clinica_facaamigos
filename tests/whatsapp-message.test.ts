// tests/whatsapp-message.test.ts
//
// Mensagens e links de aviso manual por WhatsApp (lib/whatsapp-message.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthorizationApprovedMessage,
  buildRenewalApprovedMessage,
  buildRenewalRequestMessage,
  buildWhatsappLink,
} from "../lib/whatsapp-message.ts";

test("buildAuthorizationApprovedMessage usa o primeiro nome e cai em texto genérico sem dados", () => {
  const full = buildAuthorizationApprovedMessage({ guardianName: "Maria da Silva", patientName: "Ana Souza", insurerName: "IASEP" });
  assert.match(full, /^Olá Maria! /);
  assert.match(full, /o plano IASEP autorizou a avaliação de Ana Souza/);
  const bare = buildAuthorizationApprovedMessage({});
  assert.match(bare, /^Olá! Boa notícia: o plano autorizou a avaliação\./);
});

test("buildRenewalApprovedMessage mostra sessões e vigência em dd/mm/aaaa", () => {
  const msg = buildRenewalApprovedMessage({
    guardianName: "João",
    patientName: "Pedro",
    insurerName: "PROASA",
    sessions: 24,
    validTo: "2027-03-31",
  });
  assert.match(msg, /renovação da guia de Pedro: 24 sessões, válidas até 31\/03\/2027\./);
  assert.doesNotMatch(buildRenewalApprovedMessage({ sessions: 0, validTo: "lixo" }), /válidas até/);
});

test("buildRenewalRequestMessage pede o pedido médico, com validade ou saldo conforme o motivo", () => {
  const vence = buildRenewalRequestMessage({
    guardianName: "Maria da Silva",
    patientName: "Ana",
    insurerName: "IASEP",
    reason: "vencendo",
    validTo: "2026-11-12",
  });
  assert.match(vence, /^Olá Maria! A guia do plano IASEP de Ana vence em 12\/11\/2026\./);
  assert.match(vence, /pedido médico atualizado/);
  const saldo = buildRenewalRequestMessage({ reason: "poucas_sessoes", sessionsRemaining: 1 });
  assert.match(saldo, /^Olá! A guia está chegando ao fim \(resta 1 sessão\)\./);
});

test("buildWhatsappLink normaliza o telefone e codifica a mensagem", () => {
  assert.equal(buildWhatsappLink("(86) 99999-0000", "Olá & tudo bem?"), "https://wa.me/5586999990000?text=Ol%C3%A1%20%26%20tudo%20bem%3F");
});
