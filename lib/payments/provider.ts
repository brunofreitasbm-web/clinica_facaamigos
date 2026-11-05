// lib/payments/provider.ts
// Contrato do gateway de pagamento. O resto do sistema depende SÓ desta interface, para
// trocar o Asaas pelo Efí (ou outro com Pix Automático) sem reescrever contratos, faturas e régua.

export type CustomerInput = {
  externalReference: string; // id do contrato
  name: string;
  cpfCnpj: string;
  email?: string | null;
  mobilePhone?: string | null;
};

export type PixAuthorization = {
  id: string;
  status: "CREATED" | "ACTIVE" | "CANCELLED" | "REFUSED" | "EXPIRED" | string;
  /** Copia-e-cola do QR da 1ª cobrança (a família autoriza o débito ao pagá-la). */
  qrPayload?: string;
  qrImageBase64?: string;
};

export type ChargeResult = {
  id: string;
  status: string;
  boletoUrl?: string;
  /** Copia-e-cola Pix da cobrança (boleto híbrido ou Pix). */
  pixPayload?: string;
};

export interface PaymentProvider {
  readonly name: "asaas" | "efi";
  upsertCustomer(input: CustomerInput): Promise<{ id: string }>;
  /** Cria a autorização do Pix Automático (modo MANUAL: a aplicação cria uma cobrança por ciclo). */
  createPixAutomaticAuthorization(input: {
    customerId: string;
    contractId: string;
    startDate: string; // AAAA-MM-DD
    /** Valor FIXO do pacote. Mudar o valor exige cancelar e criar outra autorização. */
    value: number;
    description: string;
    firstChargeValue: number;
    qrExpirationSeconds: number;
  }): Promise<PixAuthorization>;
  /** Só com autorização ACTIVE, de 2 a 10 dias úteis antes do vencimento. */
  createPixAutomaticCharge(input: {
    customerId: string;
    authorizationId: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
  }): Promise<ChargeResult>;
  createBoleto(input: {
    customerId: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
  }): Promise<ChargeResult>;
  /** Recupera uma cobrança já criada para esta fatura (externalReference = id da fatura), para nunca duplicar numa nova tentativa. */
  findChargeByExternalReference(externalReference: string): Promise<ChargeResult | null>;
  cancelPixAutomaticAuthorization(authorizationId: string): Promise<void>;
  cancelCharge(chargeId: string): Promise<void>;
}

export class PaymentProviderError extends Error {
  readonly status: number;
  readonly body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "PaymentProviderError";
    this.status = status;
    this.body = body;
  }
}
