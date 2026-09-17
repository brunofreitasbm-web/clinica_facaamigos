// lib/contract-billing.ts
/**
 * Helpers puros de cálculo de cobrança de contrato particular (FASE 2 —
 * Contratos pacote/avulsa). Sem I/O: nada aqui consulta o banco nem o
 * relógio do processo além do parâmetro recebido, para poder ser testado
 * isoladamente (ver tests/contract-billing.test.ts).
 */
/**
 * Mensalidade do pacote = valor unitário da especialidade × sessões/mês —
 * mesmo cálculo de `packageTotal` (lib/specialty-prices.ts, usado pelo
 * cadastro de preços particulares e pelo chatbot de FAQ), reimplementado
 * aqui (sem importar de lá) para este módulo continuar sem nenhum import
 * com alias "@/*": é assim que tests/contract-billing.test.ts consegue
 * importá-lo direto via `node --experimental-strip-types`, que não resolve
 * os path aliases do tsconfig (só o bundler do Next.js resolve). Arredonda
 * para 2 casas decimais — evita 199.999999999 por ponto flutuante ao
 * persistir em `patient_contracts.monthly_fee` (numeric(10,2)).
 */
export function computeMonthlyFee(unitPrice: number, sessionsPerMonth: number): number {
  return Math.round(unitPrice * sessionsPerMonth * 100) / 100;
}

/**
 * Data de vencimento da fatura de um mês de competência, dado o dia de
 * vencimento configurado no contrato (`invoice_day`). Espelha a lógica SQL
 * de `generate_package_invoices` (supabase/migrations/
 * 20260917170200_contracts_billing_mode.sql): o dia é fixado dentro do mês
 * de `referenceMonth`, mas nunca ultrapassa o último dia civil desse mês
 * (ex.: invoiceDay=31 em fevereiro vira dia 28, ou 29 em ano bissexto).
 *
 * `referenceMonth` só precisa apontar para o mês/ano corretos no fuso
 * `timezone` — o dia do mês do parâmetro é ignorado.
 */
export function nextInvoiceDueDate(referenceMonth: Date, invoiceDay: number, timezone: string): Date {
  const civilMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).format(referenceMonth);
  const [year, month] = civilMonth.split("-").map(Number);

  // Dia 0 do mês seguinte = último dia do mês corrente (aritmética de
  // calendário pura, sem depender de fuso para a subtração).
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, invoiceDay), lastDayOfMonth);

  return new Date(Date.UTC(year, month - 1, clampedDay));
}
