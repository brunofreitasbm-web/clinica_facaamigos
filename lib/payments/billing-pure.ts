// lib/payments/billing-pure.ts
// Regras PURAS da cobrança dos Pacotes de Sessões particulares (sem import com alias `@/`,
// roda em `node --test --experimental-strip-types`; ver tests/billing-pure.test.ts).
// Nada aqui fala com gateway, banco ou WhatsApp.

export type BillingMethod = "pix_automatico" | "boleto";

/** Pacote exclusivo de 6 sessões: só Pix Automático (decisão de negócio). */
export const PONTE_PLAN_CODE = "PART-PLANO-PONTE";

/** Multa fixa por atraso (CDC art. 52 §1º) e juros de mora ao mês. */
export const LATE_FINE_RATE = 0.02;
export const LATE_INTEREST_MONTHLY_RATE = 0.01;

/** Dia do mês ANTERIOR à competência em que a fatura (pré-paga) vence. */
export const DEFAULT_INVOICE_DAY = 25;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Primeiro dia da competência (AAAA-MM-01) a partir de qualquer data AAAA-MM-DD. */
export function competenceStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Competência do mês seguinte a `isoDate` (AAAA-MM-01). */
export function nextCompetence(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-01`;
}

/**
 * Pré-pago: a fatura da competência `competence` (AAAA-MM-01) vence no `invoiceDay`
 * do mês anterior (dez/2026 vence em 25/11/2026), limitado ao último dia daquele mês.
 */
export function invoiceDueDate(competence: string, invoiceDay: number = DEFAULT_INVOICE_DAY): string {
  const [y, m] = competence.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const day = Math.min(Math.max(1, Math.trunc(invoiceDay)), lastDayOfMonth(py, pm));
  return `${py}-${pad(pm)}-${pad(day)}`;
}

/** Dias corridos entre duas datas AAAA-MM-DD (positivo se `to` é depois de `from`). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Valor proporcional para quem entra no meio do mês: sessões que ainda cabem no mês
 * sobre as sessões do pacote. Nunca passa do valor cheio nem fica negativo.
 */
export function proratedAmount(fullPrice: number, packageSessions: number, remainingSessions: number): number {
  if (packageSessions <= 0) return round2(fullPrice);
  const k = Math.min(Math.max(remainingSessions, 0), packageSessions);
  return round2((fullPrice * k) / packageSessions);
}

export type LateCharges = { fine: number; interest: number; total: number; daysLate: number };

/**
 * Multa de 2% + juros de 1% ao mês, pro rata por dia, sobre o valor original.
 * Sem atraso, sem encargos. Não capitaliza (juros simples), como no CDC.
 */
export function lateCharges(amount: number, dueDate: string, payDate: string): LateCharges {
  const daysLate = Math.max(0, daysBetween(dueDate, payDate));
  if (daysLate === 0) return { fine: 0, interest: 0, total: round2(amount), daysLate: 0 };
  const fine = round2(amount * LATE_FINE_RATE);
  const interest = round2(amount * LATE_INTEREST_MONTHLY_RATE * (daysLate / 30));
  return { fine, interest, total: round2(amount + fine + interest), daysLate };
}

/**
 * Meio de cobrança efetivo. O pacote Ponte só existe no Pix Automático: se a família
 * pedir boleto, o plano não é aceito (a tela deve oferecer o Primeiro Passo ou o Laço).
 */
export function resolveBillingMethod(
  planCode: string | null | undefined,
  requested: BillingMethod,
): { ok: true; method: BillingMethod } | { ok: false; reason: string } {
  if (planCode === PONTE_PLAN_CODE && requested !== "pix_automatico") {
    return { ok: false, reason: "O Pacote Ponte é exclusivo do Pix Automático." };
  }
  return { ok: true, method: requested };
}

/** Descrição que vai ao gateway/boleto/NFS-e: nunca cita terapia, diagnóstico ou criança (LGPD art. 11). */
export function chargeDescription(competence: string): string {
  const [y, m] = competence.split("-");
  return `Serviços de saúde – competência ${m}/${y} – Instituto Faça Amigos`;
}

export type DunningStep =
  | "d_minus_5"
  | "d_minus_1"
  | "d_plus_1"
  | "d_plus_3"
  | "d_plus_6_call"
  | "d_plus_10_formal"
  | "d_plus_15_notice"
  | "d_plus_30_suspension";

/** Ordem cronológica da régua; usada para nunca repetir nem voltar um passo. */
export const DUNNING_ORDER: DunningStep[] = [
  "d_minus_5",
  "d_minus_1",
  "d_plus_1",
  "d_plus_3",
  "d_plus_6_call",
  "d_plus_10_formal",
  "d_plus_15_notice",
  "d_plus_30_suspension",
];

/** Dias em relação ao vencimento (negativo = antes) em que cada passo passa a valer. */
const STEP_DAY: Record<DunningStep, number> = {
  d_minus_5: -5,
  d_minus_1: -1,
  d_plus_1: 1,
  d_plus_3: 3,
  d_plus_6_call: 6,
  d_plus_10_formal: 10,
  d_plus_15_notice: 15,
  d_plus_30_suspension: 30,
};

/** Passos que só geram tarefa para uma pessoa (nunca mensagem automática). */
export const HUMAN_ONLY_STEPS: ReadonlySet<DunningStep> = new Set([
  "d_plus_6_call",
  "d_plus_15_notice",
  "d_plus_30_suspension",
]);

/**
 * Próximo passo da régua devido hoje, ou null. `offsetDays` = hoje − vencimento.
 * - D−1 só vale para boleto (o Pix Automático debita sozinho).
 * - Pega no máximo um passo por execução, o mais antigo ainda não feito, para que um
 *   atraso descoberto tarde (ex.: cron parado) não dispare 4 mensagens de uma vez.
 * - Se já passou do passo seguinte ao pendente, pula os mais antigos de mensagem
 *   (não faz sentido mandar "lembrete D−5" a quem está 12 dias atrasado).
 */
export function nextDunningStep(
  offsetDays: number,
  method: BillingMethod,
  lastStep: DunningStep | null,
): DunningStep | null {
  const lastIdx = lastStep ? DUNNING_ORDER.indexOf(lastStep) : -1;
  const due = DUNNING_ORDER.filter((s, i) => {
    if (i <= lastIdx) return false;
    if (s === "d_minus_1" && method === "pix_automatico") return false;
    return offsetDays >= STEP_DAY[s];
  });
  if (due.length === 0) return null;
  // Entre os devidos, vale o mais recente (o último já alcançado).
  return due[due.length - 1];
}

/**
 * Janela de envio: das 8h às 20h (exclusive) de segunda a sábado, em America/Sao_Paulo.
 */
export function isWithinSendWindow(now: Date, timeZone = "America/Sao_Paulo"): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sun") return false;
  return hour >= 8 && hour < 20;
}

/** Data AAAA-MM-DD "de hoje" em America/Sao_Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Pix Automático revogado ou com débito falho → a fatura em aberto precisa virar boleto,
 * exceto no Pacote Ponte, que não aceita boleto: aí o contrato vai para revisão humana.
 */
export function fallbackOnPixAutomaticFailure(
  planCode: string | null | undefined,
): "emit_boleto" | "manual_review" {
  return planCode === PONTE_PLAN_CODE ? "manual_review" : "emit_boleto";
}

/**
 * Janela de emissão no gateway. O Asaas exige que a instrução do Pix Automático seja criada
 * de 2 a 10 DIAS ÚTEIS antes do vencimento (≈ 4 a 14 dias corridos, contando fins de semana).
 * Para boleto não há restrição: emite assim que a fatura entra na janela de 14 dias.
 */
export const EMIT_WINDOW_MIN_DAYS = 4;
export const EMIT_WINDOW_MAX_DAYS = 13;

export function shouldEmitNow(daysToDue: number, method: BillingMethod): boolean {
  if (method === "pix_automatico") {
    return daysToDue >= EMIT_WINDOW_MIN_DAYS && daysToDue <= EMIT_WINDOW_MAX_DAYS;
  }
  return daysToDue <= EMIT_WINDOW_MAX_DAYS + 1 && daysToDue >= 1;
}
