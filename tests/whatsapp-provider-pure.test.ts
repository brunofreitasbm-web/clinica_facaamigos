// tests/whatsapp-provider-pure.test.ts
//
// Escolha do provedor de WhatsApp (lib/whatsapp/provider-pure.ts): padrão
// continua Twilio e valor inválido nunca cai em silêncio em outro provedor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWhatsAppProviderId } from "../lib/whatsapp/provider-pure.ts";

test("ausente ou vazio mantém Twilio (comportamento atual)", () => {
  assert.equal(resolveWhatsAppProviderId(undefined), "twilio");
  assert.equal(resolveWhatsAppProviderId(""), "twilio");
  assert.equal(resolveWhatsAppProviderId("   "), "twilio");
});

test("aceita twilio e meta, ignorando caixa e espaços", () => {
  assert.equal(resolveWhatsAppProviderId(" Twilio "), "twilio");
  assert.equal(resolveWhatsAppProviderId("META"), "meta");
});

test("valor desconhecido devolve null para falhar alto", () => {
  assert.equal(resolveWhatsAppProviderId("360dialog"), null);
  assert.equal(resolveWhatsAppProviderId("twilio,meta"), null);
});
