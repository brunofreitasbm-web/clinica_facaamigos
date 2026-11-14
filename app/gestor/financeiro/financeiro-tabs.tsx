"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RepasseRow, GlosaRow } from "./data";
import { markPayoutPaid } from "@/app/faturamento/repasses/actions";
import { ClosePayoutsConfirm } from "@/components/close-payouts-confirm";
import type { GlosaBreakdown, GlosaBreakdownRow } from "@/lib/glosa-analytics";

const REPASSE_STATUS_TAG: Record<RepasseRow["statusLabel"], string> = {
  "A pagar": "st-agendada",
  Pago: "st-realizada",
  "Sem módulos": "st-cancelada",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ClosePayoutsButton({ competenceMonth }: { competenceMonth: string }) {
  return <ClosePayoutsConfirm competenceMonth={competenceMonth} buttonClassName="btn btn-primary" />;
}

function MarkPaidAction({ payoutId }: { payoutId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markPayoutPaid(payoutId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button type="button" onClick={handleMarkPaid} disabled={isPending} className="btn btn-ghost text-xs">
        {isPending ? "Marcando…" : "Marcar como pago"}
      </button>
      {error && (
        <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>
          {error}
        </span>
      )}
    </span>
  );
}

export function FinanceiroTabs({
  repasseRows,
  glosaRows,
  glosaBreakdown,
  competenceMonth,
}: {
  repasseRows: RepasseRow[];
  glosaRows: GlosaRow[];
  glosaBreakdown: GlosaBreakdown;
  competenceMonth: string;
}) {
  const [view, setView] = useState<"repasses" | "glosas">("repasses");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        {view === "repasses" && <ClosePayoutsButton competenceMonth={competenceMonth} />}
      </div>

      {view === "repasses" && (
        <table className="table mt-6">
          <thead>
            <tr>
              <th>Terapeuta</th>
              <th>Faixa</th>
              <th>Módulos entregues</th>
              <th>Valor bruto</th>
              <th>Honorário</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {repasseRows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.name}</td>
                <td>{r.tier}</td>
                <td className="tabular-figure">{r.modulesDeliveredCount}</td>
                <td className="tabular-figure">{currency.format(r.grossAmount)}</td>
                <td className="tabular-figure">{currency.format(r.repasseAmount)}</td>
                <td>
                  <span className={`tag-status ${REPASSE_STATUS_TAG[r.statusLabel]}`}>{r.statusLabel}</span>
                  {r.isLive && r.statusLabel !== "Sem módulos" && (
                    <span className="ml-2 text-[11px] text-ink-faint">calculado ao vivo</span>
                  )}
                  {!r.isLive && r.payoutId && r.statusLabel === "A pagar" && <MarkPaidAction payoutId={r.payoutId} />}
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

      {view === "glosas" && glosaBreakdown.totalCount > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <GlosaBreakdownTable title="Por motivo" rows={glosaBreakdown.byReason} />
          <GlosaBreakdownTable title="Por plano de saúde" rows={glosaBreakdown.byInsurer} />
          <GlosaBreakdownTable title="Por pessoa/cargo atribuído" rows={glosaBreakdown.byPerson} />
        </div>
      )}

      {view === "glosas" && (
        <table className="table mt-6">
          <thead>
            <tr>
              <th>Plano de Saúde</th>
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

function GlosaBreakdownTable({ title, rows }: { title: string; rows: GlosaBreakdownRow[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-faint">Sem dados.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-paper-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-1.5 pr-2">
                  <p className="font-medium text-ink">{r.label}</p>
                  <p className="text-ink-faint">{r.count} glosa(s)</p>
                </td>
                <td className="py-1.5 text-right tabular-figure">
                  <p className="font-medium" style={{ color: "var(--status-falta)" }}>{currency.format(r.amount)}</p>
                  <p className="text-ink-faint">{r.recoveryRatePct !== null ? `${r.recoveryRatePct}% recuperado` : "—"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
