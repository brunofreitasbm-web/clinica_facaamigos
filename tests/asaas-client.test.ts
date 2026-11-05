import test from "node:test";
import assert from "node:assert/strict";
import { createAsaasProvider } from "../lib/payments/asaas.ts";
import { PaymentProviderError } from "../lib/payments/provider.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Call = { url: string; method: string; headers: Record<string, string>; body?: Record<string, any> };

function mock(responses: { status?: number; json: unknown }[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const r = responses.shift() ?? { json: {} };
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { calls, p: createAsaasProvider({ apiKey: "KEY", fetchImpl }) };
}

test("autorização Pix Automático: caminho, header e corpo conforme a documentação", async () => {
  const { calls, p } = mock([{ json: { id: "auth_1", status: "CREATED", payload: "000201...", encodedImage: "abc" } }]);
  const r = await p.createPixAutomaticAuthorization({
    customerId: "cus_1", contractId: "c".repeat(40), startDate: "2026-11-25", value: 1050,
    description: "Pacote de sessões Faça Amigos - extra longo", firstChargeValue: 1050, qrExpirationSeconds: 86400,
  });
  assert.equal(calls[0].url, "https://api-sandbox.asaas.com/v3/pix/automatic/authorizations");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.access_token, "KEY");
  assert.equal(calls[0].body.frequency, "MONTHLY");
  assert.equal(calls[0].body.paymentCreationMode, "MANUAL");
  assert.equal(calls[0].body.contractId.length, 35);
  assert.equal(calls[0].body.description.length, 35);
  assert.deepEqual(calls[0].body.immediateQrCode, { expirationSeconds: 86400, originalValue: 1050 });
  assert.deepEqual(r, { id: "auth_1", status: "CREATED", qrPayload: "000201...", qrImageBase64: "abc" });
});

test("cobrança Pix Automático envia pixAutomaticAuthorizationId e externalReference", async () => {
  const { calls, p } = mock([{ json: { id: "pay_1", status: "PENDING" } }]);
  const r = await p.createPixAutomaticCharge({ customerId: "cus_1", authorizationId: "auth_1", value: 1050, dueDate: "2026-12-25", description: "x", externalReference: "inv_1" });
  assert.equal(calls[0].url, "https://api-sandbox.asaas.com/v3/payments");
  assert.equal(calls[0].body.billingType, "PIX");
  assert.equal(calls[0].body.pixAutomaticAuthorizationId, "auth_1");
  assert.equal(calls[0].body.externalReference, "inv_1");
  assert.equal(r.id, "pay_1");
});

test("boleto leva multa 2% e juros 1% e busca o QR Pix; falha do QR não derruba", async () => {
  const ok = mock([{ json: { id: "pay_2", status: "PENDING", bankSlipUrl: "https://b/1" } }, { json: { payload: "pix-copia-cola" } }]);
  const a = await ok.p.createBoleto({ customerId: "cus_1", value: 1400, dueDate: "2026-12-25", description: "x", externalReference: "inv_2" });
  assert.deepEqual(ok.calls[0].body.fine, { value: 2 });
  assert.deepEqual(ok.calls[0].body.interest, { value: 1 });
  assert.equal(a.boletoUrl, "https://b/1");
  assert.equal(a.pixPayload, "pix-copia-cola");
  const noQr = mock([{ json: { id: "pay_3", status: "PENDING", bankSlipUrl: "https://b/3" } }, { status: 404, json: { errors: [{ description: "nao encontrado" }] } }]);
  const b = await noQr.p.createBoleto({ customerId: "cus_1", value: 1400, dueDate: "2026-12-25", description: "x", externalReference: "inv_3" });
  assert.equal(b.id, "pay_3");
  assert.equal(b.pixPayload, undefined);
});

test("cliente existente é reaproveitado pelo externalReference", async () => {
  const { calls, p } = mock([{ json: { data: [{ id: "cus_9" }] } }]);
  const r = await p.upsertCustomer({ externalReference: "contract-1", name: "Maria", cpfCnpj: "123.456.789-09" });
  assert.equal(r.id, "cus_9");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /externalReference=contract-1/);
});

test("cliente novo manda só dígitos no CPF e desliga o aviso do gateway", async () => {
  const { calls, p } = mock([{ json: { data: [] } }, { json: { id: "cus_10" } }]);
  await p.upsertCustomer({ externalReference: "contract-2", name: "João", cpfCnpj: "123.456.789-09", mobilePhone: "(91) 98888-7777" });
  assert.equal(calls[1].body.cpfCnpj, "12345678909");
  assert.equal(calls[1].body.mobilePhone, "91988887777");
  assert.equal(calls[1].body.notificationDisabled, true);
});

test("erro 400 vira PaymentProviderError com a descrição do Asaas", async () => {
  const { p } = mock([{ status: 400, json: { errors: [{ code: "invalid_action", description: "Autorização não está ativa" }] } }]);
  await assert.rejects(
    p.createPixAutomaticCharge({ customerId: "c", authorizationId: "a", value: 1, dueDate: "2026-12-25", description: "x", externalReference: "i" }),
    (e: unknown) => e instanceof PaymentProviderError && e.status === 400 && /não está ativa/.test(e.message),
  );
});

test("cancelar autorização usa DELETE no caminho documentado", async () => {
  const { calls, p } = mock([{ json: {} }]);
  await p.cancelPixAutomaticAuthorization("auth_1");
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, "https://api-sandbox.asaas.com/v3/pix/automatic/authorizations/auth_1");
});

test("recupera cobrança existente pelo externalReference e ignora as excluídas", async () => {
  const { calls, p } = mock([{ json: { data: [{ id: "pay_old", status: "PENDING", deleted: true }, { id: "pay_ok", status: "PENDING", bankSlipUrl: "https://b/ok" }] } }]);
  const r = await p.findChargeByExternalReference("inv_1");
  assert.equal(r?.id, "pay_ok");
  assert.match(calls[0].url, /externalReference=inv_1/);
  const none = mock([{ json: { data: [] } }]);
  assert.equal(await none.p.findChargeByExternalReference("inv_2"), null);
});
