import { createAsaasProvider } from "./asaas";
import type { PaymentProvider } from "./provider";

/** Gateway configurado por env. Lança se a chave não existir (rotas respondem 503, nunca fingem sucesso). */
export function getPaymentProvider(): PaymentProvider {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  return createAsaasProvider({ apiKey, baseUrl: process.env.ASAAS_BASE_URL });
}

export function isPaymentGatewayConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}
