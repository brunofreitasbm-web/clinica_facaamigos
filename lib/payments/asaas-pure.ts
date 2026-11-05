// lib/payments/asaas-pure.ts
// Normaliza o webhook do Asaas num evento interno. PURO (sem `@/`), testado em
// tests/asaas-pure.test.ts com payloads no formato descrito em docs.asaas.com
// (eventos de Pix Automático: /docs/eventos-para-pix-automático).

export type NormalizedPaymentEvent = {
  /** id do evento no Asaas (evt_...), chave de idempotência. */
  eventId: string;
  kind:
    | "payment_received"
    | "payment_overdue"
    | "payment_refunded"
    | "payment_deleted"
    | "authorization_active"
    | "authorization_failed" // cancelada, recusada ou expirada
    | "instruction_refused"
    | "ignored";
  rawEvent: string;
  chargeId?: string;
  customerId?: string;
  authorizationId?: string;
  paidAmount?: number;
  netAmount?: number;
  paidAt?: string;
  reason?: string;
};

type AnyObj = Record<string, unknown>;
const obj = (v: unknown): AnyObj => (v && typeof v === "object" ? (v as AnyObj) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Constant-time para o token do header `asaas-access-token`. */
export function tokensMatch(expected: string | undefined | null, received: string | undefined | null): boolean {
  if (!expected || !received) return false;
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

export function normalizeAsaasEvent(payload: unknown): NormalizedPaymentEvent | null {
  const p = obj(payload);
  const rawEvent = str(p.event);
  const eventId = str(p.id);
  if (!rawEvent || !eventId) return null;

  const base = { eventId, rawEvent };

  if (rawEvent === "PAYMENT_RECEIVED" || rawEvent === "PAYMENT_CONFIRMED") {
    const pay = obj(p.payment);
    return {
      ...base,
      kind: "payment_received",
      chargeId: str(pay.id),
      customerId: str(pay.customer),
      paidAmount: num(pay.value),
      netAmount: num(pay.netValue),
      paidAt: str(pay.paymentDate) ?? str(pay.clientPaymentDate),
    };
  }
  if (rawEvent === "PAYMENT_OVERDUE") {
    return { ...base, kind: "payment_overdue", chargeId: str(obj(p.payment).id) };
  }
  if (rawEvent === "PAYMENT_REFUNDED") {
    return { ...base, kind: "payment_refunded", chargeId: str(obj(p.payment).id) };
  }
  if (rawEvent === "PAYMENT_DELETED") {
    return { ...base, kind: "payment_deleted", chargeId: str(obj(p.payment).id) };
  }

  if (rawEvent === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED") {
    return { ...base, kind: "authorization_active", authorizationId: str(obj(p.authorization).id) };
  }
  if (
    rawEvent === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED" ||
    rawEvent === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED" ||
    rawEvent === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED"
  ) {
    const a = obj(p.authorization);
    return {
      ...base,
      kind: "authorization_failed",
      authorizationId: str(a.id),
      reason: str(a.cancellationReason) ?? rawEvent.replace("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_", "").toLowerCase(),
    };
  }
  if (rawEvent === "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED") {
    const pi = obj(p.paymentInstruction);
    return {
      ...base,
      kind: "instruction_refused",
      chargeId: str(pi.paymentId),
      authorizationId: str(obj(pi.authorization).id),
    };
  }
  return { ...base, kind: "ignored" };
}
