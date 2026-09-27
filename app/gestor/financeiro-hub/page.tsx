import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/page-container";
import { FinanceiroHubSubnav } from "@/components/financeiro-hub-subnav";
import { FinanceHubMonthPicker } from "@/components/finance-hub-month-picker";
import { getConsolidatedFinancials } from "@/lib/finance-hub/dre";
import { resolveMonthParam, monthLabel } from "@/lib/finance-hub/month";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function FinanceiroHubDrePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const competenceMonth = resolveMonthParam(mes);
  const supabase = await createClient();
  const rows = await getConsolidatedFinancials(supabase, competenceMonth);

  const totalReceita = rows.reduce((s, r) => s + r.receitaOperacional, 0);
  const totalResultado = rows.reduce((s, r) => s + r.resultadoLiquido, 0);

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FinanceiroHubSubnav activeTab="dre" mes={competenceMonth} />

      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Financeiro HUB · restrito
            </h6>
            <h1 className="m-0">DRE consolidado — {monthLabel(competenceMonth)}</h1>
          </div>
          <FinanceHubMonthPicker basePath="/gestor/financeiro-hub" mes={competenceMonth} />
        </div>

        <section className="grid grid-cols-2 gap-6 pt-8 sm:grid-cols-2">
          <div className="card">
            <span className="card-kicker">Receita operacional total</span>
            <span className="card-title tabular-figure" style={{ fontSize: 26 }}>
              {currency.format(totalReceita)}
            </span>
            <span className="card-body">Playground + Circuito + Clínica, no mês</span>
          </div>
          <div className="card">
            <span className="card-kicker">Resultado líquido total</span>
            <span
              className="card-title tabular-figure"
              style={{ fontSize: 26, color: totalResultado >= 0 ? "var(--color-accent)" : "var(--status-falta)" }}
            >
              {currency.format(totalResultado)}
            </span>
            <span className="card-body">após impostos, depreciação e financeiro</span>
          </div>
        </section>

        <section className="pt-8 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>DRE</th>
                {rows.map((r) => (
                  <th key={r.unit.id} style={{ textAlign: "right" }}>
                    {r.unit.nome}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {rows.some((r) => !r.disponivel) && (
                <tr>
                  <td colSpan={rows.length + 2} style={{ color: "var(--status-falta)" }}>
                    {rows
                      .filter((r) => !r.disponivel)
                      .map((r) => `${r.unit.nome}: ${r.motivoIndisponivel}`)
                      .join(" · ")}
                  </td>
                </tr>
              )}
              <DreLine label="Receita operacional" rows={rows} pick={(r) => r.receitaOperacional} />
              <DreLine label="(–) Custos diretos" rows={rows} pick={(r) => -r.custosDiretos} />
              <DreLine label="= Resultado bruto" rows={rows} pick={(r) => r.resultadoBruto} strong />
              <DreLine label="(–) Despesas operacionais" rows={rows} pick={(r) => -r.despesasOperacionais} />
              <DreLine label="= Resultado operacional" rows={rows} pick={(r) => r.resultadoOperacional} strong />
              <DreLine label="(+) Receitas financeiras" rows={rows} pick={(r) => r.receitasFinanceiras} />
              <DreLine label="(–) Despesas financeiras" rows={rows} pick={(r) => -r.despesasFinanceiras} />
              <DreLine label="(–) Depreciação" rows={rows} pick={(r) => -r.depreciacao} />
              <DreLine label="(–) Impostos" rows={rows} pick={(r) => -r.impostos} />
              <DreLine label="(+/–) Ajuste manual" rows={rows} pick={(r) => r.ajusteManual} />
              <DreLine label="= Resultado líquido" rows={rows} pick={(r) => r.resultadoLiquido} strong />
            </tbody>
          </table>
          <p className="card-body pt-4" style={{ opacity: 0.75 }}>
            Playground e Circuito: receita e custo direto vêm ao vivo do sistema de caixa (PDV); despesas
            operacionais, impostos, depreciação e ajustes vêm de{" "}
            <a href={`/gestor/financeiro-hub/lancamentos?mes=${competenceMonth}`}>Lançamentos Manuais</a>. Clínica:
            receita (convênio + particular), repasse a terapeutas e despesas operacionais vêm ao vivo de
            faturamento/contas a pagar/repasses; o resto é manual.
          </p>
        </section>
      </PageContainer>
    </main>
  );
}

function DreLine({
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
