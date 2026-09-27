import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { FinanceiroHubSubnav } from "@/components/financeiro-hub-subnav";
import { FinanceHubMonthPicker } from "@/components/finance-hub-month-picker";
import { getConsolidatedFinancials } from "@/lib/finance-hub/dre";
import { resolveMonthParam, monthLabel } from "@/lib/finance-hub/month";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function FluxoCaixaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const competenceMonth = resolveMonthParam(mes);
  const supabase = await createClient();
  const rows = await getConsolidatedFinancials(supabase, competenceMonth);

  const operacional = rows.reduce((s, r) => s + r.entradaCaixaOperacional - r.saidaCaixaOperacional, 0);
  const financiamento = rows.reduce((s, r) => s + r.aportesSocios - r.retiradasSocios, 0);
  const totalMovimento = operacional + financiamento;

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FinanceiroHubSubnav activeTab="fluxo-caixa" mes={competenceMonth} />

      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Financeiro HUB · restrito
            </h6>
            <h1 className="m-0">Fluxo de Caixa — {monthLabel(competenceMonth)}</h1>
          </div>
          <FinanceHubMonthPicker basePath="/gestor/financeiro-hub/fluxo-caixa" mes={competenceMonth} />
        </div>

        <section className="grid grid-cols-2 gap-6 pt-8 sm:grid-cols-3">
          <div className="card">
            <span className="card-kicker">Caixa operacional</span>
            <span className="card-title tabular-figure" style={{ fontSize: 24 }}>
              {currency.format(operacional)}
            </span>
            <span className="card-body">entradas − saídas do dia a dia</span>
          </div>
          <div className="card">
            <span className="card-kicker">Financiamento (sócios)</span>
            <span className="card-title tabular-figure" style={{ fontSize: 24 }}>
              {currency.format(financiamento)}
            </span>
            <span className="card-body">aportes − retiradas</span>
          </div>
          <div className="card">
            <span className="card-kicker">Variação de caixa no mês</span>
            <span
              className="card-title tabular-figure"
              style={{ fontSize: 24, color: totalMovimento >= 0 ? "var(--color-accent)" : "var(--status-falta)" }}
            >
              {currency.format(totalMovimento)}
            </span>
            <span className="card-body">operacional + financiamento</span>
          </div>
        </section>

        <section className="pt-8 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Fluxo de caixa</th>
                {rows.map((r) => (
                  <th key={r.unit.id} style={{ textAlign: "right" }}>
                    {r.unit.nome}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Consolidado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={rows.length + 2} style={{ fontWeight: 700, paddingTop: 16 }}>
                  Atividades operacionais
                </td>
              </tr>
              <CashLine label="(+) Entradas de caixa" rows={rows} pick={(r) => r.entradaCaixaOperacional} />
              <CashLine label="(–) Saídas de caixa" rows={rows} pick={(r) => -r.saidaCaixaOperacional} />
              <CashLine
                label="= Caixa operacional líquido"
                rows={rows}
                pick={(r) => r.entradaCaixaOperacional - r.saidaCaixaOperacional}
                strong
              />
              <tr>
                <td colSpan={rows.length + 2} style={{ fontWeight: 700, paddingTop: 16 }}>
                  Atividades de financiamento
                </td>
              </tr>
              <CashLine label="(+) Aportes de sócios" rows={rows} pick={(r) => r.aportesSocios} />
              <CashLine label="(–) Retiradas de sócios" rows={rows} pick={(r) => -r.retiradasSocios} />
              <CashLine
                label="= Caixa de financiamento líquido"
                rows={rows}
                pick={(r) => r.aportesSocios - r.retiradasSocios}
                strong
              />
              <tr>
                <td style={{ fontWeight: 800, paddingTop: 16 }}>Variação de caixa no mês</td>
                {rows.map((r) => (
                  <td key={r.unit.id} style={{ textAlign: "right", fontWeight: 800, paddingTop: 16 }} className="tabular-figure">
                    {currency.format(
                      r.entradaCaixaOperacional - r.saidaCaixaOperacional + r.aportesSocios - r.retiradasSocios
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "right", fontWeight: 800, paddingTop: 16 }} className="tabular-figure">
                  {currency.format(totalMovimento)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="card-body pt-4" style={{ opacity: 0.75 }}>
            Não há atividades de investimento modeladas automaticamente (compra de equipamento, empréstimos
            tomados/quitados) — lance qualquer valor desse tipo em Lançamentos Manuais &gt; Ajuste, com a nota
            explicando o quê.
          </p>
        </section>
      </PageContainer>
    </main>
  );
}

function CashLine({
  label,
  rows,
  pick,
  strong,
}: {
  label: string;
  rows: Awaited<ReturnType<typeof getConsolidatedFinancials>>;
  pick: (r: Awaited<ReturnType<typeof getConsolidatedFinancials>>[number]) => number;
  strong?: boolean;
}) {
  const total = rows.reduce((s, r) => s + pick(r), 0);
  return (
    <tr style={strong ? { fontWeight: 700 } : undefined}>
      <td>{label}</td>
      {rows.map((r) => (
        <td key={r.unit.id} style={{ textAlign: "right" }} className="tabular-figure">
          {currency.format(pick(r))}
        </td>
      ))}
      <td style={{ textAlign: "right" }} className="tabular-figure">
        {currency.format(total)}
      </td>
    </tr>
  );
}
