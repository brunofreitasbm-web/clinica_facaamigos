import Link from "next/link";
import { GestorNav } from "@/components/gestor-nav";
import { getBonificacaoData, approveTherapistTierChange } from "./actions";

export default async function BonificacaoPage() {
  const { plrMetrics, tierProposals } = await getBonificacaoData();

  const recepcaoMetrics = plrMetrics.filter((m) => m.role === "recepcao");
  const faturamentoMetrics = plrMetrics.filter((m) => m.role === "faturamento");

  return (
    <div className="min-h-screen bg-canvas">
      <GestorNav />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Top Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">
              Metrificação, PLR e Progressão de Faixas (PJ)
            </h1>
            <p className="text-sm text-ink-soft">
              Painel de apuração de bônus semestral (CLT) e revisão trimestral de faixa de valor-hora (PJ) com dados auditáveis.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-md border border-paper-line-strong bg-paper px-4 py-2 text-xs font-semibold text-ink shadow-sm hover:bg-paper-subtle">
              📄 Exportar Memória de Cálculo PLR
            </button>
          </div>
        </div>

        {/* ── SEÇÃO 1: PLR RECEPÇÃO E FATURAMENTO ───────────────────────────── */}
        <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-paper-line pb-4">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                Lei 10.101/2000 · Apuração Semestral
              </span>
              <h2 className="text-lg font-bold text-ink">
                Participação nos Lucros e Resultados (PLR)
              </h2>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2.5 text-emerald-800 dark:text-emerald-300 border border-emerald-200">
                <span>Atingimento Geral Recepção: </span>
                <strong className="text-sm font-bold">100%</strong>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2.5 text-emerald-800 dark:text-emerald-300 border border-emerald-200">
                <span>Atingimento Geral Faturamento: </span>
                <strong className="text-sm font-bold">100%</strong>
              </div>
            </div>
          </div>

          {/* Tabela Recepção */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent"></span>
              Métricas da Recepção (Peso Total: 100%)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                  <tr>
                    <th className="p-3">Métrica</th>
                    <th className="p-3">Meta Exigida</th>
                    <th className="p-3">Realizado no Período</th>
                    <th className="p-3">Peso</th>
                    <th className="p-3">Atingimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-line">
                  {recepcaoMetrics.map((m) => (
                    <tr key={m.key}>
                      <td className="p-3 font-medium text-ink">
                        {m.label}
                        {m.isEliminatory && (
                          <span className="ml-2 text-[10px] text-red-600 font-bold uppercase">
                            (Eliminatório)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-ink-soft">{m.targetValue}</td>
                      <td className="p-3 font-semibold text-ink">{m.actualValue}</td>
                      <td className="p-3">{m.weight}%</td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          ✓ {m.scorePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela Faturamento */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent"></span>
              Métricas do Faturamento (Peso Total: 100%)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                  <tr>
                    <th className="p-3">Métrica</th>
                    <th className="p-3">Meta Exigida</th>
                    <th className="p-3">Realizado no Período</th>
                    <th className="p-3">Peso</th>
                    <th className="p-3">Atingimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-line">
                  {faturamentoMetrics.map((m) => (
                    <tr key={m.key}>
                      <td className="p-3 font-medium text-ink">{m.label}</td>
                      <td className="p-3 text-ink-soft">{m.targetValue}</td>
                      <td className="p-3 font-semibold text-ink">{m.actualValue}</td>
                      <td className="p-3">{m.weight}%</td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          ✓ {m.scorePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── SEÇÃO 2: PROGRESSÃO DE FAIXA PJ ───────────────────────────── */}
        <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-6">
          <div className="border-b border-paper-line pb-4">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">
              Revisão Trimestral Contratual PJ
            </span>
            <h2 className="text-lg font-bold text-ink">
              Proposta de Progressão de Faixa de Valor-Hora
            </h2>
            <p className="text-xs text-ink-soft mt-1">
              Critérios contratuais objetivos: Evolução em 24h ≥ 98%, Retenção 90 dias ≥ 90%, Cancelamentos pelo terapeuta ≤ 2%.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                <tr>
                  <th className="p-3">Terapeuta (PJ)</th>
                  <th className="p-3">Evoluções 24h</th>
                  <th className="p-3">Retenção 90d</th>
                  <th className="p-3">Faixa Atual</th>
                  <th className="p-3">Faixa Proposta</th>
                  <th className="p-3 text-right">Ação do Gestor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {tierProposals.map((prop) => (
                  <tr key={prop.profileId} className="hover:bg-paper-subtle/50 transition-colors">
                    <td className="p-3 font-semibold text-ink">
                      {prop.therapistName}
                    </td>
                    <td className="p-3">
                      <span className={prop.note24hRate >= 98 ? "text-emerald-700 font-medium" : "text-red-600 font-medium"}>
                        {prop.note24hRate}%
                      </span>
                    </td>
                    <td className="p-3 font-medium">{prop.retention90dRate}%</td>
                    <td className="p-3 text-ink-soft">
                      {prop.currentTier} (R$ {prop.currentRate.toFixed(2)})
                    </td>
                    <td className="p-3 font-bold text-emerald-700">
                      {prop.proposedTier} (R$ {prop.proposedRate.toFixed(2)})
                    </td>
                    <td className="p-3 text-right">
                      {prop.status === "elegivel" ? (
                        <form action={approveTherapistTierChange} className="inline-block">
                          <input type="hidden" name="profile_id" value={prop.profileId} />
                          <input type="hidden" name="proposed_rate" value={prop.proposedRate} />
                          <button
                            type="submit"
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                          >
                            ✓ Aprovar Promoção
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-ink-faint italic">
                          Manter Faixa Atual
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
