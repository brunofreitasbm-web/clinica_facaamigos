"use client";

import { useState } from "react";
import type { RepasseRow, GlosaRow } from "./data";

const REPASSE_STATUS_TAG: Record<RepasseRow["statusLabel"], string> = {
  "A pagar": "st-agendada",
  Pago: "st-realizada",
  "Sem sessões": "st-cancelada",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceiroTabs({ repasseRows, glosaRows }: { repasseRows: RepasseRow[]; glosaRows: GlosaRow[] }) {
  const [view, setView] = useState<"repasses" | "glosas">("repasses");

  return (
    <div>
      <div className="seg w-fit">
        <label className="seg-opt">
          <input type="radio" name="financeiro-view" checked={view === "repasses"} onChange={() => setView("repasses")} />
          Repasses
        </label>
        <label className="seg-opt">
          <input type="radio" name="financeiro-view" checked={view === "glosas"} onChange={() => setView("glosas")} />
          Glosas
        </label>
      </div>

      {view === "repasses" && (
        <table className="table mt-6">
          <thead>
            <tr>
              <th>Terapeuta</th>
              <th>Faixa</th>
              <th>Sessões faturadas</th>
              <th>Valor bruto</th>
              <th>Repasse</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {repasseRows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.name}</td>
                <td>{r.tier}</td>
                <td className="tabular-figure">{r.sessionsCount}</td>
                <td className="tabular-figure">{currency.format(r.grossAmount)}</td>
                <td className="tabular-figure">{currency.format(r.repasseAmount)}</td>
                <td>
                  <span className={`tag-status ${REPASSE_STATUS_TAG[r.statusLabel]}`}>{r.statusLabel}</span>
                  {r.isLive && r.statusLabel !== "Sem sessões" && (
                    <span className="ml-2 text-[11px] text-ink-faint">calculado ao vivo</span>
                  )}
                </td>
              </tr>
            ))}
            {repasseRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-ink-faint">
                  Nenhum terapeuta com contrato ativo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {view === "glosas" && (
        <table className="table mt-6">
          <thead>
            <tr>
              <th>Convênio</th>
              <th>Guia</th>
              <th>Código</th>
              <th>Motivo</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {glosaRows.map((g) => (
              <tr key={g.id}>
                <td className="font-semibold">{g.insurerName}</td>
                <td>{g.guideNumber}</td>
                <td>{g.procedureCode}</td>
                <td>{g.reason}</td>
                <td className="tabular-figure">{currency.format(g.amount)}</td>
                <td>
                  <span className={`tag-status ${g.tagClass}`}>{g.statusLabel}</span>
                </td>
              </tr>
            ))}
            {glosaRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-ink-faint">
                  Nenhuma glosa registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
