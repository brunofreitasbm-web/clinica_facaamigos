// tests/whatsapp-message.test.ts
//
// Mensagens e links de aviso manual por WhatsApp (lib/whatsapp-message.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthorizationApprovedMessage,
  buildRenewalApprovedMessage,
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

test("buildWhatsappLink normaliza o telefone e codifica a mensagem", () => {
  assert.equal(buildWhatsappLink("(86) 99999-0000", "Olá & tudo bem?"), "https://wa.me/5586999990000?text=Ol%C3%A1%20%26%20tudo%20bem%3F");
});
