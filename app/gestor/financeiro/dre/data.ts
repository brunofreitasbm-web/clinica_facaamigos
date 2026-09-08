import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

export type DreMonthRow = {
  monthKey: string;
  label: string;
  grossRevenue: number;
  therapistPayout: number;
  contributionMargin: number;
  operatingExpenses: number;
  netResult: number;
};

function monthKeys(count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  return keys;
}

/**
 * DRE simplificado: receita bruta - repasse a terapeuta (via
 * `v_contribution_margin`, view já existente e nunca usada em nenhuma tela)
 * - despesas operacionais (`accounts_payable`, por mês de vencimento).
 * Não é uma DRE contábil completa (sem impostos sobre receita, depreciação
 * etc.) — é a margem de contribuição operacional que o gestor já tinha
 * disponível na BI menos as despesas fixas que agora têm onde entrar.
 */
export async function getDreByMonth(supabase: Supa, clinicId: string, months = 6): Promise<DreMonthRow[]> {
  const keys = monthKeys(months);
  const earliestMonth = `${keys[0]}-01`;

  const [{ data: marginRows }, { data: expenseRows }] = await Promise.all([
    supabase
      .from("v_contribution_margin")
      .select("competence_month, gross_revenue, total_therapist_payout, contribution_margin")
      .eq("clinic_id", clinicId)
      .gte("competence_month", earliestMonth),
    supabase
      .from("accounts_payable")
      .select("amount, due_date, status")
      .eq("clinic_id", clinicId)
      .neq("status", "cancelado")
      .gte("due_date", earliestMonth),
  ]);

  const marginByMonth = new Map<string, { grossRevenue: number; therapistPayout: number; contributionMargin: number }>();
  for (const row of marginRows ?? []) {
    if (!row.competence_month) continue;
    const key = row.competence_month.slice(0, 7);
    marginByMonth.set(key, {
      grossRevenue: Number(row.gross_revenue ?? 0),
      therapistPayout: Number(row.total_therapist_payout ?? 0),
      contributionMargin: Number(row.contribution_margin ?? 0),
    });
  }

  const expensesByMonth = new Map<string, number>();
  for (const row of expenseRows ?? []) {
    const key = row.due_date.slice(0, 7);
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + Number(row.amount));
  }

  return keys.map((key) => {
    const margin = marginByMonth.get(key) ?? { grossRevenue: 0, therapistPayout: 0, contributionMargin: 0 };
    const operatingExpenses = expensesByMonth.get(key) ?? 0;
    const [year, month] = key.split("-");
    const label = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    return {
      monthKey: key,
      label,
      grossRevenue: margin.grossRevenue,
      therapistPayout: margin.therapistPayout,
      contributionMargin: margin.contributionMargin,
      operatingExpenses,
      netResult: margin.contributionMargin - operatingExpenses,
    };
  });
}

export type CashFlowBucket = {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  runningBalance: number;
};

/**
 * Fluxo de caixa projetado pros próximos ~90 dias, em 3 baldes mensais.
 * Entradas: faturas de contrato particular pendentes/atrasadas
 * (contract_invoices) com vencimento no balde. Saídas: contas a pagar
 * pendentes/atrasadas com vencimento no balde, mais o repasse em aberto do
 * mês corrente (assumido no 1º balde, pago em D+1 do fechamento). Não inclui
 * saldo bancário real — não há integração com conta corrente — é só a
 * projeção líquida de entradas menos saídas já conhecidas no sistema.
 */
export async function getCashFlowProjection(
  supabase: Supa,
  clinicId: string,
  openPayoutTotal: number,
): Promise<CashFlowBucket[]> {
  const now = new Date();
  const bucketStarts = [0, 1, 2].map((i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)));
  const rangeStart = bucketStarts[0]!.toISOString().slice(0, 10);
  const rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1)).toISOString().slice(0, 10);

  const { data: contractRows } = await supabase
    .from("patient_contracts")
    .select("id")
    .eq("clinic_id", clinicId);
  const contractIds = (contractRows ?? []).map((c) => c.id);

  const [{ data: invoiceRows }, { data: expenseRows }] = await Promise.all([
    contractIds.length
      ? supabase
          .from("contract_invoices")
          .select("amount, due_date, status")
          .in("contract_id", contractIds)
          .in("status", ["pendente", "atrasado"])
          .gte("due_date", rangeStart)
          .lt("due_date", rangeEnd)
      : Promise.resolve({ data: [] as { amount: number; due_date: string; status: string }[] }),
    supabase
      .from("accounts_payable")
      .select("amount, due_date, status")
      .eq("clinic_id", clinicId)
      .in("status", ["pendente", "atrasado"])
      .gte("due_date", rangeStart)
      .lt("due_date", rangeEnd),
  ]);

  function bucketIndexFor(dateStr: string): number {
    const d = new Date(`${dateStr}T00:00:00Z`);
    for (let i = bucketStarts.length - 1; i >= 0; i--) {
      if (d >= bucketStarts[i]!) return i;
    }
    return 0;
  }

  const inflowByBucket = [0, 0, 0];
  for (const row of invoiceRows ?? []) {
    inflowByBucket[bucketIndexFor(row.due_date)] += Number(row.amount);
  }

  const outflowByBucket = [0, 0, 0];
  for (const row of expenseRows ?? []) {
    outflowByBucket[bucketIndexFor(row.due_date)] += Number(row.amount);
  }
  outflowByBucket[0] += openPayoutTotal;

  let running = 0;
  return bucketStarts.map((start, i) => {
    const net = inflowByBucket[i]! - outflowByBucket[i]!;
    running += net;
    return {
      label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      inflow: inflowByBucket[i]!,
      outflow: outflowByBucket[i]!,
      net,
      runningBalance: running,
    };
  });
}
