// lib/payments/asaas.ts
// Cliente Asaas. Caminhos e campos de Pix Automático conferidos em docs.asaas.com (nov/2026):
//   POST   /v3/pix/automatic/authorizations      (frequency, contractId, startDate, customerId,
//                                                 immediateQrCode{expirationSeconds, originalValue}, value, ...)
//   DELETE /v3/pix/automatic/authorizations/{id}
//   POST   /v3/payments                          (customer, billingType, value, dueDate, pixAutomaticAuthorizationId)
// Header de autenticação: `access_token`. Sandbox: https://api-sandbox.asaas.com.
// NÃO conferidos na documentação lida: criação de cliente (/v3/customers), QR Pix da cobrança
// (/v3/payments/{id}/pixQrCode) e cancelamento de cobrança (DELETE /v3/payments/{id}). São os
// endpoints públicos conhecidos do Asaas; validar no sandbox antes de produção (runbook).
import {
  PaymentProviderError,
  type ChargeResult,
  type CustomerInput,
  type PaymentProvider,
  type PixAuthorization,
} from "./provider.ts";

type FetchLike = typeof fetch;

export type AsaasConfig = {
  apiKey: string;
  /** Padrão: sandbox. Em produção, definir ASAAS_BASE_URL (URL de produção conforme a conta/documentação). */
  baseUrl?: string;
  fetchImpl?: FetchLike;
  userAgent?: string;
};

export const ASAAS_SANDBOX_URL = "https://api-sandbox.asaas.com";

export function createAsaasProvider(cfg: AsaasConfig): PaymentProvider {
  const base = (cfg.baseUrl ?? ASAAS_SANDBOX_URL).replace(/\/+$/, "");
  const doFetch = cfg.fetchImpl ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        access_token: cfg.apiKey,
        "user-agent": cfg.userAgent ?? "InstitutoFacaAmigos/1.0",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    if (!res.ok) {
      const errs = (json as { errors?: { description?: string }[] } | undefined)?.errors;
      const msg = errs?.map((e) => e.description).filter(Boolean).join("; ") || `Asaas ${method} ${path} → ${res.status}`;
      throw new PaymentProviderError(msg, res.status, json);
    }
    return json as T;
  }

  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  return {
    name: "asaas",

    async upsertCustomer(input: CustomerInput) {
      // externalReference = id do contrato: permite recuperar o cliente se a gravação local falhar.
      const found = await call<{ data?: { id: string }[] }>(
        "GET",
        `/v3/customers?externalReference=${encodeURIComponent(input.externalReference)}&limit=1`,
      );
      if (found.data?.[0]) return { id: found.data[0].id };
      const created = await call<{ id: string }>("POST", "/v3/customers", {
        name: input.name,
        cpfCnpj: onlyDigits(input.cpfCnpj),
        email: input.email ?? undefined,
        mobilePhone: input.mobilePhone ? onlyDigits(input.mobilePhone) : undefined,
        externalReference: input.externalReference,
        notificationDisabled: true, // a régua de cobrança é nossa (WhatsApp/e-mail), sem aviso duplicado do Asaas
      });
      return { id: created.id };
    },

    async createPixAutomaticAuthorization(input): Promise<PixAuthorization> {
      const r = await call<{
        id: string;
        status: string;
        payload?: string;
        encodedImage?: string;
      }>("POST", "/v3/pix/automatic/authorizations", {
        frequency: "MONTHLY",
        contractId: input.contractId.slice(0, 35),
        startDate: input.startDate,
        customerId: input.customerId,
        value: input.value,
        description: input.description.slice(0, 35),
        paymentCreationMode: "MANUAL",
        retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
        immediateQrCode: {
          expirationSeconds: input.qrExpirationSeconds,
          originalValue: input.firstChargeValue,
        },
      });
      return { id: r.id, status: r.status, qrPayload: r.payload, qrImageBase64: r.encodedImage };
    },

    async createPixAutomaticCharge(input): Promise<ChargeResult> {
      const r = await call<{ id: string; status: string }>("POST", "/v3/payments", {
        customer: input.customerId,
        billingType: "PIX",
        value: input.value,
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
        pixAutomaticAuthorizationId: input.authorizationId,
      });
      return { id: r.id, status: r.status };
    },

    async createBoleto(input): Promise<ChargeResult> {
      const r = await call<{ id: string; status: string; bankSlipUrl?: string; invoiceUrl?: string }>(
        "POST",
        "/v3/payments",
        {
          customer: input.customerId,
          billingType: "BOLETO",
          value: input.value,
          dueDate: input.dueDate,
          description: input.description,
          externalReference: input.externalReference,
          // Multa e juros do contrato (CDC art. 52 §1º): 2% + 1% a.m.
          fine: { value: 2 },
          interest: { value: 1 },
        },
      );
      let pixPayload: string | undefined;
      try {
        const q = await call<{ payload?: string }>("GET", `/v3/payments/${r.id}/pixQrCode`);
        pixPayload = q.payload;
      } catch {
        // boleto sem QR Pix ainda: não bloqueia a emissão
      }
      return { id: r.id, status: r.status, boletoUrl: r.bankSlipUrl ?? r.invoiceUrl, pixPayload };
    },

    async findChargeByExternalReference(externalReference: string): Promise<ChargeResult | null> {
      const r = await call<{ data?: { id: string; status: string; bankSlipUrl?: string; invoiceUrl?: string; deleted?: boolean }[] }>(
        "GET",
        `/v3/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
      );
      const c = r.data?.find((x) => !x.deleted);
      return c ? { id: c.id, status: c.status, boletoUrl: c.bankSlipUrl ?? c.invoiceUrl } : null;
    },

    async cancelPixAutomaticAuthorization(authorizationId: string) {
      await call("DELETE", `/v3/pix/automatic/authorizations/${encodeURIComponent(authorizationId)}`);
    },

    async cancelCharge(chargeId: string) {
      await call("DELETE", `/v3/payments/${encodeURIComponent(chargeId)}`);
    },
  };
}
