import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { FinanceiroHubSubnav } from "@/components/financeiro-hub-subnav";
import { FinanceHubMonthPicker } from "@/components/finance-hub-month-picker";
import { resolveMonthParam, monthLabel } from "@/lib/finance-hub/month";
import { listFinUnits, getMonthlyEntries, listBalanceAccounts, getBalanceEntries } from "@/lib/finance-hub/repo";
import { MonthlyEntryForm } from "./monthly-entry-form";
import { BalanceCell } from "./balance-cell";
import type { FinBalanceAccount } from "@/lib/finance-hub/types";

export const dynamic = "force-dynamic";

const GROUP_LABEL: Record<FinBalanceAccount["grupo"], string> = {
  ativo_circulante: "Ativo Circulante",
  ativo_nao_circulante: "Ativo Não Circulante",
  passivo_circulante: "Passivo Circulante",
  passivo_nao_circulante: "Passivo Não Circulante",
  patrimonio_liquido: "Patrimônio Líquido",
};

export default async function LancamentosManuaisPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const competenceMonth = resolveMonthParam(mes);
  const supabase = await createClient();

  const [units, monthlyEntries, accounts, balanceEntries] = await Promise.all([
    listFinUnits(supabase),
    getMonthlyEntries(supabase, competenceMonth),
    listBalanceAccounts(supabase),
    getBalanceEntries(supabase, competenceMonth),
  ]);

  const monthlyByUnit = new Map(monthlyEntries.map((e) => [e.unit_id, e]));
  const balanceByAccountUnit = new Map(balanceEntries.map((e) => [`${e.account_id}:${e.unit_id}`, e.valor]));

  const grupos: FinBalanceAccount["grupo"][] = [
    "ativo_circulante",
    "ativo_nao_circulante",
    "passivo_circulante",
    "passivo_nao_circulante",
    "patrimonio_liquido",
  ];

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FinanceiroHubSubnav activeTab="lancamentos" mes={competenceMonth} />

      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Financeiro HUB · restrito
            </h6>
            <h1 className="m-0">Lançamentos manuais — {monthLabel(competenceMonth)}</h1>
          </div>
          <FinanceHubMonthPicker basePath="/gestor/financeiro-hub/lancamentos" mes={competenceMonth} />
        </div>

        <section className="pt-8">
          <h3>DRE do mês — o que os sistemas não fornecem</h3>
          <div className="grid gap-6 pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {units.map((unit) => (
              <MonthlyEntryForm key={unit.id} unit={unit} competenceMonth={competenceMonth} entry={monthlyByUnit.get(unit.id) ?? null} />
            ))}
          </div>
        </section>

        <section className="pt-10 overflow-x-auto">
          <h3>Balanço Patrimonial do mês — saldo por conta e unidade</h3>
          <p className="card-body pt-2" style={{ opacity: 0.75 }}>
            Salva sozinho ao sair do campo (Tab ou clicar fora). &ldquo;Depreciação acumulada&rdquo; é redutora do
            ativo: lance negativo.
          </p>
          <table className="table pt-4">
            <thead>
              <tr>
                <th>Conta</th>
                {units.map((u) => (
                  <th key={u.id} style={{ textAlign: "right" }}>
                    {u.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo) => (
                <Fragment key={grupo}>
                  <tr key={`${grupo}-h`}>
                    <td colSpan={units.length + 1} style={{ fontWeight: 700, paddingTop: 14 }}>
                      {GROUP_LABEL[grupo]}
                    </td>
                  </tr>
                  {accounts
                    .filter((a) => a.grupo === grupo)
                    .map((account) => (
                      <tr key={account.id}>
                        <td style={{ paddingLeft: 16 }}>{account.nome}</td>
                        {units.map((unit) => (
                          <td key={unit.id} style={{ width: 140 }}>
                            <BalanceCell
                              accountId={account.id}
                              unitId={unit.id}
                              competenceMonth={competenceMonth}
                              initialValue={balanceByAccountUnit.get(`${account.id}:${unit.id}`) ?? 0}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      </PageContainer>
    </main>
  );
}
