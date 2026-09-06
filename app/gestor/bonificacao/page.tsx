import { GestorNav } from "@/components/gestor-nav";
import { EquipeSubnav } from "@/components/equipe-subnav";
import { getBonificacaoData } from "./actions";
import { TierApprovalForm } from "./tier-approval-form";
import { PLRSectionClient } from "@/components/gestor/plr-section-client";

export default async function BonificacaoPage() {
  const { bonusRows, tierRows, closedHistory } = await getBonificacaoData();

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <GestorNav active="equipe" />
      <EquipeSubnav activeTab="bonificacao" />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Metrificação, PLR e Progressão de Faixas (PJ)
          </h1>
          <p className="text-sm text-ink-soft">
            Indicadores calculados ao vivo sobre o mês corrente (§10 do PRD). O job mensal
            `close_monthly_metric_snapshots` (dia 1) grava as métricas congeladas em
            `metric_snapshots`. Abaixo você pode gerar o extrato oficial de PLR em PDF (Lei 10.101/2000) com apuração ponderada.
          </p>
        </div>

        {/* ── SEÇÃO 1: INDICADORES POR CARGO (CLT → PLR) ─────────────────── */}
        <PLRSectionClient bonusRows={bonusRows} />

        {/* ── HISTÓRICO FECHADO (metric_snapshots, job mensal dia 1) ─────── */}
        <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
          <div className="border-b border-paper-line pb-4">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">
              §10.6 · Fechamento mensal automático
            </span>
            <h2 className="text-lg font-bold text-ink">Histórico de meses fechados</h2>
            <p className="text-xs text-ink-soft mt-1">
              Gravado no dia 1 de cada mês pelo job `close_monthly_metric_snapshots` — diferente da
              seção acima (que recalcula o mês em andamento a cada carregamento), isto é o valor
              congelado do mês já fechado, auditável.
            </p>
          </div>
          {closedHistory.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nenhum mês fechado ainda — a primeira linha aparece no dia 1 do próximo mês.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                  <tr>
                    <th className="p-3">Mês</th>
                    <th className="p-3">Indicador</th>
                    <th className="p-3">Valor fechado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-line">
                  {closedHistory.map((row, i) => (
                    <tr key={`${row.periodLabel}-${row.metricKey}-${i}`}>
                      <td className="p-3 font-medium text-ink">{row.periodLabel}</td>
                      <td className="p-3 text-ink-soft">{row.metricLabel}</td>
                      <td className="p-3 font-semibold text-ink">{row.valueLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── SEÇÃO 2: PROGRESSÃO DE FAIXA PJ ───────────────────────────── */}
        <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-6">
          <div className="border-b border-paper-line pb-4">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">
              Revisão Trimestral Contratual PJ (§10.3 & §13)
            </span>
            <h2 className="text-lg font-bold text-ink">
              Progressão de Faixa de Valor-Hora
            </h2>
            <p className="text-xs text-ink-soft mt-1">
              Critérios objetivos avaliados: evoluções registradas em 24h ≥ 98%, faltas recuperadas e acompanhamento dos PEIs.
              A progressão exige ação explícita do gestor (Aprovação ou Manutenção justificada gravada em audit_log).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                <tr>
                  <th className="p-3">Terapeuta (PJ)</th>
                  <th className="p-3">Evoluções 24h</th>
                  <th className="p-3">Faltas recuperadas</th>
                  <th className="p-3">Faixa Atual</th>
                  <th className="p-3 text-right">Ação do Gestor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {tierRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-ink-soft">
                      Nenhum terapeuta ativo cadastrado.
                    </td>
                  </tr>
                )}
                {tierRows.map((row) => (
                  <tr key={row.id} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="p-3 font-semibold text-ink">{row.name}</td>
                    <td className="p-3">{row.note24hRateLabel}</td>
                    <td className="p-3 font-medium">{row.faltasRecuperadasLabel}</td>
                    <td className="p-3 text-ink-soft">
                      {row.tier}
                      {row.currentRate != null && ` (R$ ${row.currentRate.toFixed(2)})`}
                    </td>
                    <td className="p-3 text-right">
                      {row.eligible ? (
                        <TierApprovalForm row={row} />
                      ) : (
                        <span className="text-xs font-medium text-ink-faint italic">
                          {row.nextTierLabel}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
