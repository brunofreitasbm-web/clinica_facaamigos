import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { GestorNav } from "@/components/gestor-nav";
import { FinanceiroSubnav } from "@/components/financeiro-subnav";
import { getRepasseRows } from "../data";
import { getDreByMonth, getCashFlowProjection } from "./data";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function DrePage() {
  const supabase = await createClient();

  const { totalOpenPayout } = await getRepasseRows(supabase, DEV_CLINIC_ID);
  const [dreRows, cashFlow] = await Promise.all([
    getDreByMonth(supabase, DEV_CLINIC_ID),
    getCashFlowProjection(supabase, DEV_CLINIC_ID, totalOpenPayout),
  ]);

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active="financeiro" />
      <FinanceiroSubnav activeTab="dre" />

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
            Financeiro
          </h6>
          <h1 className="m-0">DRE Simplificado & Fluxo de Caixa Projetado</h1>
          <p className="text-sm text-ink-faint mt-2 max-w-2xl">
            Margem de contribuição (receita faturada − repasse a terapeutas) menos despesas operacionais cadastradas em Contas a
            Pagar. Não substitui a DRE contábil oficial — não considera impostos sobre a receita nem depreciação.
          </p>
        </div>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Resultado por Mês (últimos 6 meses)</h3>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Receita Bruta</th>
                <th>Repasse Terapeutas</th>
                <th>Margem de Contribuição</th>
                <th>Despesas Operacionais</th>
                <th>Resultado Líquido</th>
              </tr>
            </thead>
            <tbody>
              {dreRows.map((row) => (
                <tr key={row.monthKey}>
                  <td className="font-semibold capitalize">{row.label}</td>
                  <td className="tabular-figure text-xs">{currency.format(row.grossRevenue)}</td>
                  <td className="tabular-figure text-xs text-ink-faint">{currency.format(row.therapistPayout)}</td>
                  <td className="tabular-figure text-xs font-medium">{currency.format(row.contributionMargin)}</td>
                  <td className="tabular-figure text-xs text-ink-faint">{currency.format(row.operatingExpenses)}</td>
                  <td
                    className="tabular-figure font-bold text-sm"
                    style={{ color: row.netResult >= 0 ? "var(--status-realizada)" : "var(--status-falta)" }}
                  >
                    {currency.format(row.netResult)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-1">Fluxo de Caixa Projetado</h3>
          <p className="text-xs text-ink-faint mb-4">
            Entradas de faturas de contrato particular pendentes e saídas de contas a pagar e repasse em aberto, por mês de
            vencimento. Não inclui saldo bancário — é a projeção líquida do que já está lançado no sistema.
          </p>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Entradas Previstas</th>
                <th>Saídas Previstas</th>
                <th>Saldo do Mês</th>
                <th>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((row) => (
                <tr key={row.label}>
                  <td className="font-semibold capitalize">{row.label}</td>
                  <td className="tabular-figure text-xs" style={{ color: "var(--status-realizada)" }}>
                    {currency.format(row.inflow)}
                  </td>
                  <td className="tabular-figure text-xs" style={{ color: "var(--status-falta)" }}>
                    {currency.format(row.outflow)}
                  </td>
                  <td className="tabular-figure text-xs font-medium" style={{ color: row.net >= 0 ? "var(--status-realizada)" : "var(--status-falta)" }}>
                    {currency.format(row.net)}
                  </td>
                  <td
                    className="tabular-figure font-bold text-sm"
                    style={{ color: row.runningBalance >= 0 ? "var(--status-realizada)" : "var(--status-falta)" }}
                  >
                    {currency.format(row.runningBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
