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
    <div className="min-h-screen bg-[#faf8f3] text-[#1c2530]">
      <FaturamentoHeader active="repasses" />

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e4dfd2] pb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1c2530]" style={{ fontFamily: "var(--font-heading)" }}>
              Repasse Financeiro PJ (Split Terapeutas)
            </h1>
            <p className="text-sm text-[#57606b]">
              Cálculo e liquidação automatizada de honorários por produção de atendimento clínica / profissional.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <PayoutStatementModal />
            <button
              onClick={handleApproveAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-md bg-[#1b8a6b] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0e5c44] transition-colors disabled:opacity-50"
            >
              {isProcessing ? "⏳ Processando Lote..." : "💵 Aprovar e Executar Repasses em Lote (PIX)"}
            </button>
          </div>
        </div>

        {/* Notificação de Sucesso */}
        {successMessage && (
          <div className="rounded-lg border border-[#1b8a6b] bg-[#dcefe8] p-4 text-xs font-semibold text-[#0e5c44] flex justify-between items-center">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="underline text-[#0e5c44]">
              Fechar
            </button>
          </div>
        )}

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[#e4dfd2] bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-[#5f656f] uppercase">Total Bruto Faturado</span>
            <div className="text-2xl font-semibold text-[#1c2530] tabular-nums mt-1 font-mono">
              R$ {totals.totalGross.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#57606b] mt-1">{totals.totalSessions} sessões realizadas</div>
          </div>

          <div className="rounded-lg border border-[#e4dfd2] bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-[#5f656f] uppercase">Retenção Clínica (Taxa)</span>
            <div className="text-2xl font-semibold text-[#0f5c7d] tabular-nums mt-1 font-mono">
              R$ {totals.totalClinicFee.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#57606b] mt-1">Média de 26.6% de margem</div>
          </div>

          <div className="rounded-lg border border-[#e4dfd2] bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-[#5f656f] uppercase">Total Líquido Repasses</span>
            <div className="text-2xl font-semibold text-[#1b8a6b] tabular-nums mt-1 font-mono">
              R$ {totals.totalNetPayout.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#57606b] mt-1">Líquido a pagar aos terapeutas</div>
          </div>

          <div className="rounded-lg border border-[#e4dfd2] bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-[#5f656f] uppercase">Profissionais no Lote</span>
            <div className="text-2xl font-semibold text-[#c97c1f] tabular-nums mt-1 font-mono">
              {payouts.length}
            </div>
            <div className="text-[11px] text-[#57606b] mt-1">Contratos ativos no mês</div>
          </div>
        </div>

        {/* Tabela de Repasses por Terapeuta */}
        <div className="rounded-lg border border-[#cfc8b4] bg-white overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#e4dfd2] bg-[#faf8f3] flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#1c2530]">Detalhamento por Profissional PJ</h3>
            <span className="text-xs text-[#57606b]">Competência: Agosto / 2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1c2530]">
              <thead className="bg-[#faf8f3] border-b border-[#e4dfd2] text-[#5f656f] font-medium uppercase">
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
              <tbody className="divide-y divide-[#e4dfd2]">
                {payouts.map((p) => (
                  <tr key={p.therapistId} className="hover:bg-[#faf8f3]/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-[#1c2530]">{p.therapistName}</div>
                      <div className="text-[11px] text-[#57606b] font-mono">{p.councilNumber}</div>
                    </td>
                    <td className="p-3.5 font-medium">{p.discipline}</td>
                    <td className="p-3.5 font-mono text-[11px] text-[#57606b]">{p.pixKey}</td>
                    <td className="p-3.5 text-center font-mono font-semibold">{p.totalSessions}</td>
                    <td className="p-3.5 text-right font-mono">R$ {p.grossAmount.toFixed(2)}</td>
                    <td className="p-3.5 text-right font-mono text-[#0f5c7d]">
                      - R$ {p.clinicFeeAmount.toFixed(2)} ({p.clinicFeePercentage}%)
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-[#1b8a6b]">
                      R$ {p.netPayoutAmount.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          p.status === "pago"
                            ? "bg-[#dcefe8] text-[#0e5c44]"
                            : p.status === "aprovado"
                            ? "bg-[#d9e8ee] text-[#0a4a5f]"
                            : "bg-[#f6e8d5] text-[#8a530e]"
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
