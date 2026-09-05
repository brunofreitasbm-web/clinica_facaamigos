"use client";

import { useState } from "react";
import { FaturamentoHeader } from "../faturamento-header";
import { PayoutStatementModal } from "@/components/payout-statement";
import { MOCK_PAYOUTS, calculateTotalPayout, TherapistPayoutSummary } from "@/lib/financeiro/payout-calculator";

export default function RepassesPage() {
  const [payouts, setPayouts] = useState<TherapistPayoutSummary[]>(MOCK_PAYOUTS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const totals = calculateTotalPayout(payouts);

  const handleApproveAll = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setPayouts((prev) =>
        prev.map((p) => ({ ...p, status: "pago" as const }))
      );
      setIsProcessing(false);
      setSuccessMessage("Repasses em lote aprovados e enviados para processamento bancário (PIX Lote) com sucesso!");
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <FaturamentoHeader active="repasses" />

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-paper-line pb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
              Repasse Financeiro PJ (Split Terapeutas)
            </h1>
            <p className="text-sm text-ink-soft">
              Cálculo e liquidação automatizada de honorários por produção de atendimento clínica / profissional.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <PayoutStatementModal />
            <button
              onClick={handleApproveAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-md bg-status-positive px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-status-positive-text transition-colors disabled:opacity-50"
            >
              {isProcessing ? "⏳ Processando Lote..." : "💵 Aprovar e Executar Repasses em Lote (PIX)"}
            </button>
          </div>
        </div>

        {/* Notificação de Sucesso */}
        {successMessage && (
          <div className="rounded-lg border border-status-positive bg-status-positive-soft p-4 text-xs font-semibold text-status-positive-text flex justify-between items-center">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="underline text-status-positive-text">
              Fechar
            </button>
          </div>
        )}

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Total Bruto Faturado</span>
            <div className="text-2xl font-semibold text-ink tabular-nums mt-1 font-mono">
              R$ {totals.totalGross.toFixed(2)}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">{totals.totalSessions} sessões realizadas</div>
          </div>

          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Retenção Clínica (Taxa)</span>
            <div className="text-2xl font-semibold text-chart tabular-nums mt-1 font-mono">
              R$ {totals.totalClinicFee.toFixed(2)}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">Média de 26.6% de margem</div>
          </div>

          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Total Líquido Repasses</span>
            <div className="text-2xl font-semibold text-status-positive tabular-nums mt-1 font-mono">
              R$ {totals.totalNetPayout.toFixed(2)}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">Líquido a pagar aos terapeutas</div>
          </div>

          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Profissionais no Lote</span>
            <div className="text-2xl font-semibold text-gold tabular-nums mt-1 font-mono">
              {payouts.length}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">Contratos ativos no mês</div>
          </div>
        </div>

        {/* Tabela de Repasses por Terapeuta */}
        <div className="rounded-lg border border-paper-line-strong bg-white overflow-hidden shadow-sm">
          <div className="p-4 border-b border-paper-line bg-paper flex justify-between items-center">
            <h3 className="text-sm font-bold text-ink">Detalhamento por Profissional PJ</h3>
            <span className="text-xs text-ink-soft">Competência: Agosto / 2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="bg-paper border-b border-paper-line text-ink-faint font-medium uppercase">
                <tr>
                  <th className="p-3.5">Profissional / Conselho</th>
                  <th className="p-3.5">Especialidade</th>
                  <th className="p-3.5">Chave PIX</th>
                  <th className="p-3.5 text-center">Sessões</th>
                  <th className="p-3.5 text-right">Bruto (R$)</th>
                  <th className="p-3.5 text-right">Taxa Clínica</th>
                  <th className="p-3.5 text-right">Líquido A Pagar</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {payouts.map((p) => (
                  <tr key={p.therapistId} className="hover:bg-paper/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-ink">{p.therapistName}</div>
                      <div className="text-[11px] text-ink-soft font-mono">{p.councilNumber}</div>
                    </td>
                    <td className="p-3.5 font-medium">{p.discipline}</td>
                    <td className="p-3.5 font-mono text-[11px] text-ink-soft">{p.pixKey}</td>
                    <td className="p-3.5 text-center font-mono font-semibold">{p.totalSessions}</td>
                    <td className="p-3.5 text-right font-mono">R$ {p.grossAmount.toFixed(2)}</td>
                    <td className="p-3.5 text-right font-mono text-chart">
                      - R$ {p.clinicFeeAmount.toFixed(2)} ({p.clinicFeePercentage}%)
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-status-positive">
                      R$ {p.netPayoutAmount.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          p.status === "pago"
                            ? "bg-status-positive-soft text-status-positive-text"
                            : p.status === "aprovado"
                            ? "bg-status-active-soft text-status-active-text"
                            : "bg-status-pending-soft text-status-pending-text"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
