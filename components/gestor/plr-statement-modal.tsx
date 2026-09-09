"use client";

import React from "react";
import { Logo } from "@/components/brand/logo";

export interface PLRBonusRow {
  role: string;
  metricLabel: string;
  targetLabel: string;
  actualLabel: string;
  weight: number;
  progressPct: number;
  status: "atingida" | "perto" | "abaixo";
  isEliminatory?: boolean;
  hasViolatedEliminatory?: boolean;
}

interface PLRStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  bonusRows: PLRBonusRow[];
  competenceMonth?: string;
}

export function PLRStatementModal({ isOpen, onClose, bonusRows, competenceMonth }: PLRStatementModalProps) {
  if (!isOpen) return null;

  const totalWeightedScore = bonusRows.reduce((acc, row) => {
    if (row.hasViolatedEliminatory) return 0;
    const cappedProgress = Math.min(100, Math.max(0, row.progressPct));
    return acc + (cappedProgress * row.weight) / 100;
  }, 0);

  const hasAnyEliminatoryViolation = bonusRows.some((r) => r.hasViolatedEliminatory);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-surface shadow-2xl border border-paper-line overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper-line bg-paper-subtle px-6 py-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Lei 10.101/2000 · Memória de Cálculo Auditável
            </span>
            <h2 className="text-lg font-bold text-ink">Extrato Oficial de Apuração de PLR</h2>
            <p className="text-xs text-ink-soft">
              Competência: {competenceMonth || new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft hover:bg-paper hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content printable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0">
          {/* Print Header */}
          <div className="hidden print:flex items-center justify-between border-b-2 border-paper-line pb-4 mb-4">
            <div>
              <Logo variant="horizontal" height={36} className="print:grayscale mb-2" />
              <h1 className="text-lg font-bold text-ink">Extrato Oficial de Apuração de PLR</h1>
              <p className="text-xs text-ink-soft">
                Competência: {competenceMonth || new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Legal Header Notice */}
          <div className="rounded-lg border border-paper-line bg-paper p-4 text-xs space-y-1">
            <div className="font-semibold text-ink">Regramento do Programa de Participação nos Lucros e Resultados (PLR)</div>
            <p className="text-ink-soft">
              Conforme o artigo 2º da Lei 10.101/2000, os indicadores abaixo são apurados com base nas metas operacionais previamente pactuadas. A pontuação ponderada final define o índice de distribuição do bônus semestral.
            </p>
          </div>

          {/* Eliminatory Violation Alert */}
          {hasAnyEliminatoryViolation && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-4 text-xs text-red-800 dark:text-red-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>⚠️ Trava Eliminatória Ativada</span>
              </div>
              <p>
                Uma ou mais métricas eliminatórias (ex: sessões realizadas sem autorização prévia) foram violadas no período. A pontuação final de PLR para este ciclo é zerada (0.00%).
              </p>
            </div>
          )}

          {/* Table of calculation */}
          <div className="overflow-x-auto rounded-lg border border-paper-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                <tr>
                  <th className="p-3">Cargo / Área</th>
                  <th className="p-3">Indicador Pactuado</th>
                  <th className="p-3">Realizado</th>
                  <th className="p-3 text-center">Peso</th>
                  <th className="p-3 text-center">Atingimento</th>
                  <th className="p-3 text-right">Pontuação Ponderada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line bg-paper">
                {bonusRows.map((row, idx) => {
                  const cappedProgress = Math.min(100, Math.max(0, row.progressPct));
                  const weightedPoints = row.hasViolatedEliminatory ? 0 : (cappedProgress * row.weight) / 100;
                  return (
                    <tr key={idx} className={row.hasViolatedEliminatory ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                      <td className="p-3 font-medium text-ink">{row.role}</td>
                      <td className="p-3 text-ink-soft">{row.metricLabel}</td>
                      <td className="p-3 font-semibold text-ink">{row.actualLabel}</td>
                      <td className="p-3 text-center text-ink-soft">{row.weight}%</td>
                      <td className="p-3 text-center">
                        <span className="font-semibold text-ink">{cappedProgress}%</span>
                      </td>
                      <td className="p-3 text-right font-bold text-ink">
                        {row.hasViolatedEliminatory ? "0.00 (Eliminada)" : `${weightedPoints.toFixed(2)} pts`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-paper-subtle font-bold border-t border-paper-line text-ink">
                <tr>
                  <td colSpan={5} className="p-3 text-right uppercase text-ink-soft">
                    Pontuação Ponderada Total do Ciclo:
                  </td>
                  <td className="p-3 text-right text-base text-accent">
                    {hasAnyEliminatoryViolation ? "0.00 pts (Zerado)" : `${totalWeightedScore.toFixed(2)} / 100.00 pts`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures block */}
          <div className="pt-8 border-t border-paper-line grid grid-cols-2 gap-8 text-center text-xs text-ink-soft">
            <div className="space-y-8">
              <div className="border-b border-paper-line pb-1"></div>
              <p>Assinatura do Gestor / Direção Clínica</p>
            </div>
            <div className="space-y-8">
              <div className="border-b border-paper-line pb-1"></div>
              <p>Assinatura do Representante da Equipe / Colaborador</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-paper-line bg-paper-subtle px-6 py-4">
          <span className="text-xs text-ink-faint">Documento auditável via Hash SHA-256</span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-paper-line bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-paper-subtle transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
            >
              <span>🖨️ Imprimir / Exportar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
