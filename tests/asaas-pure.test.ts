import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAsaasEvent, tokensMatch } from "../lib/payments/asaas-pure.ts";

test("PAYMENT_RECEIVED vira payment_received com valores", () => {
  const e = normalizeAsaasEvent({
    id: "evt_1", event: "PAYMENT_RECEIVED",
    payment: { id: "pay_1", customer: "cus_1", value: 1050, netValue: 1048.5, paymentDate: "2026-11-25" },
  });
  assert.deepEqual(e, {
    eventId: "evt_1", rawEvent: "PAYMENT_RECEIVED", kind: "payment_received",
    chargeId: "pay_1", customerId: "cus_1", paidAmount: 1050, netAmount: 1048.5, paidAt: "2026-11-25",
  });
});

test("autorização ativada e cancelada", () => {
  const a = normalizeAsaasEvent({ id: "evt_2", event: "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED", authorization: { id: "auth_1", status: "ACTIVE" } });
  assert.equal(a?.kind, "authorization_active");
  assert.equal(a?.authorizationId, "auth_1");
  const c = normalizeAsaasEvent({ id: "evt_3", event: "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED", authorization: { id: "auth_1", cancellationReason: "REQUESTED_BY_PAYER_USER" } });
  assert.equal(c?.kind, "authorization_failed");
  assert.equal(c?.reason, "REQUESTED_BY_PAYER_USER");
});

test("instrução recusada traz a cobrança e a autorização", () => {
  const e = normalizeAsaasEvent({ id: "evt_4", event: "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED", paymentInstruction: { paymentId: "pay_9", authorization: { id: "auth_1" } } });
  assert.equal(e?.kind, "instruction_refused");
  assert.equal(e?.chargeId, "pay_9");
  assert.equal(e?.authorizationId, "auth_1");
});

test("evento desconhecido é ignorado; payload sem id/event é nulo", () => {
  assert.equal(normalizeAsaasEvent({ id: "evt_5", event: "PAYMENT_CREATED" })?.kind, "ignored");
  assert.equal(normalizeAsaasEvent({ event: "PAYMENT_RECEIVED" }), null);
  assert.equal(normalizeAsaasEvent(null), null);
});

test("token do webhook: igual, diferente, ausente", () => {
  assert.equal(tokensMatch("abc123", "abc123"), true);
  assert.equal(tokensMatch("abc123", "abc124"), false);
  assert.equal(tokensMatch("abc123", "abc12"), false);
  assert.equal(tokensMatch(undefined, "x"), false);
  assert.equal(tokensMatch("x", null), false);
});
