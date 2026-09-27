import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { FinanceiroHubSubnav } from "@/components/financeiro-hub-subnav";
import { FinanceHubMonthPicker } from "@/components/finance-hub-month-picker";
import { getBalancoPatrimonial } from "@/lib/finance-hub/balanco";
import { resolveMonthParam, monthLabel } from "@/lib/finance-hub/month";
import type { FinBalanceAccount } from "@/lib/finance-hub/types";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const GROUP_LABEL: Record<FinBalanceAccount["grupo"], string> = {
  ativo_circulante: "Ativo Circulante",
  ativo_nao_circulante: "Ativo Não Circulante",
  passivo_circulante: "Passivo Circulante",
  passivo_nao_circulante: "Passivo Não Circulante",
  patrimonio_liquido: "Patrimônio Líquido",
};

export default async function BalancoPatrimonialPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const competenceMonth = resolveMonthParam(mes);
  const supabase = await createClient();
  const data = await getBalancoPatrimonial(supabase, competenceMonth);

  const grupos: FinBalanceAccount["grupo"][] = [
    "ativo_circulante",
    "ativo_nao_circulante",
    "passivo_circulante",
    "passivo_nao_circulante",
    "patrimonio_liquido",
  ];

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FinanceiroHubSubnav activeTab="balanco" mes={competenceMonth} />

      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Financeiro HUB · restrito
            </h6>
            <h1 className="m-0">Balanço Patrimonial — {monthLabel(competenceMonth)}</h1>
          </div>
          <FinanceHubMonthPicker basePath="/gestor/financeiro-hub/balanco" mes={competenceMonth} />
        </div>

        {Math.abs(data.diferenca) > 0.01 && (
          <div className="card pt-4" style={{ borderColor: "var(--status-falta)" }}>
            <span className="card-kicker" style={{ color: "var(--status-falta)" }}>
              Balanço não fecha
            </span>
            <span className="card-body">
              Ativo ({currency.format(data.totalAtivo)}) ≠ Passivo + PL ({currency.format(data.totalPassivoMaisPl)}) —
              diferença de {currency.format(data.diferenca)}. Revise os lançamentos em{" "}
              <a href={`/gestor/financeiro-hub/lancamentos?mes=${competenceMonth}`}>Lançamentos Manuais</a>.
            </span>
          </div>
        )}

        <section className="pt-8 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Conta</th>
                {data.units.map((u) => (
                  <th key={u.id} style={{ textAlign: "right" }}>
                    {u.nome}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo) => (
                <Fragment key={grupo}>
                  <tr key={`${grupo}-header`}>
                    <td colSpan={data.units.length + 2} style={{ fontWeight: 700, paddingTop: 16 }}>
                      {GROUP_LABEL[grupo]}
                    </td>
                  </tr>
                  {data.linhasPorGrupo[grupo].map((linha) => (
                    <tr key={linha.account.id}>
                      <td style={{ paddingLeft: 16 }}>{linha.account.nome}</td>
                      {data.units.map((u) => (
                        <td key={u.id} style={{ textAlign: "right" }} className="tabular-figure">
                          {currency.format(linha.porUnidade[u.id] ?? 0)}
                        </td>
                      ))}
                      <td style={{ textAlign: "right" }} className="tabular-figure">
                        {currency.format(linha.total)}
                      </td>
                    </tr>
                  ))}
                  <tr key={`${grupo}-total`} style={{ fontWeight: 700 }}>
                    <td>Total {GROUP_LABEL[grupo]}</td>
                    {data.units.map((u) => {
                      const total = data.linhasPorGrupo[grupo].reduce((s, l) => s + (l.porUnidade[u.id] ?? 0), 0);
                      return (
                        <td key={u.id} style={{ textAlign: "right" }} className="tabular-figure">
                          {currency.format(total)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "right" }} className="tabular-figure">
                      {currency.format(data.totalPorGrupo[grupo])}
                    </td>
                  </tr>
                </Fragment>
              ))}
              <tr style={{ fontWeight: 800, borderTop: "2px solid var(--color-neutral-300)" }}>
                <td>Total Ativo</td>
                <td colSpan={data.units.length} />
                <td style={{ textAlign: "right" }} className="tabular-figure">
                  {currency.format(data.totalAtivo)}
                </td>
              </tr>
              <tr style={{ fontWeight: 800 }}>
                <td>Total Passivo + Patrimônio Líquido</td>
                <td colSpan={data.units.length} />
                <td style={{ textAlign: "right" }} className="tabular-figure">
                  {currency.format(data.totalPassivoMaisPl)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="card-body pt-4" style={{ opacity: 0.75 }}>
            Nenhum dos 3 sistemas (PDV do Playground/Circuito, prontuário/faturamento da Clínica) controla ativo e
            passivo — todo o Balanço é lançamento manual, mês a mês, em{" "}
            <a href={`/gestor/financeiro-hub/lancamentos?mes=${competenceMonth}`}>Lançamentos Manuais</a>. A
            &ldquo;Depreciação acumulada&rdquo; é redutora: lance com valor negativo.
          </p>
        </section>
      </PageContainer>
    </main>
  );
}
