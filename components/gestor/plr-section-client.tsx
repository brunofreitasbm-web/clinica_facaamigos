"use client";

import React, { useState } from "react";
import { PLRStatementModal, type PLRBonusRow } from "./plr-statement-modal";

const STATUS_STYLE: Record<string, string> = {
  atingida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  perto: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  abaixo: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
const STATUS_LABEL: Record<string, string> = {
  atingida: "✓ Meta atingida",
  perto: "⚠ Perto da meta",
  abaixo: "✗ Abaixo da meta",
};

interface PLRSectionClientProps {
  bonusRows: {
    role: string;
    metricLabel: string;
    actualLabel: string;
    status: "atingida" | "perto" | "abaixo";
    progressPct: number;
    weightPct: number;
    isEliminatory: boolean;
  }[];
}

export function PLRSectionClient({ bonusRows }: PLRSectionClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Mapear bonusRows para formato completo do modal de PLR — peso e
  // eliminatória vêm da vigência ativa em bonus_rule_sets (ou do padrão
  // §10.6 quando o cargo ainda não tem configuração publicada).
  const plrBonusRows: PLRBonusRow[] = bonusRows.map((row) => {
    const hasViolatedEliminatory = row.isEliminatory && row.status === "abaixo";

    return {
      role: row.role,
      metricLabel: row.metricLabel,
      targetLabel: "Meta do cargo",
      actualLabel: row.actualLabel,
      weight: row.weightPct,
      progressPct: row.progressPct,
      status: row.status,
      isEliminatory: row.isEliminatory,
      hasViolatedEliminatory,
    };
  });

  return (
    <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-line pb-4">
        <div>
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">
            Lei 10.101/2000 · Base para apuração de PLR
          </span>
          <h2 className="text-lg font-bold text-ink">Indicadores do mês por cargo</h2>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
        >
          <span>📄 Extrato de PLR (PDF Auditável)</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
            <tr>
              <th className="p-3">Cargo / Área</th>
              <th className="p-3">Indicador Operacional</th>
              <th className="p-3">Realizado no Mês</th>
              <th className="p-3">Atingimento</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {bonusRows.map((row) => (
              <tr key={row.role} className="hover:bg-paper-subtle/50 transition-colors">
                <td className="p-3 font-medium text-ink">{row.role}</td>
                <td className="p-3 text-ink-soft">{row.metricLabel}</td>
                <td className="p-3 font-semibold text-ink">{row.actualLabel}</td>
                <td className="p-3 font-semibold text-ink">{row.progressPct}%</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[row.status]}`}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PLRStatementModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        bonusRows={plrBonusRows}
      />
    </section>
  );
}
