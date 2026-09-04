"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RepasseRow, GlosaRow } from "./data";
import { closePayouts, markPayoutPaid } from "./actions";

const REPASSE_STATUS_TAG: Record<RepasseRow["statusLabel"], string> = {
  "A pagar": "st-agendada",
  Pago: "st-realizada",
  "Sem sessões": "st-cancelada",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ClosePayoutsButton({ competenceMonth }: { competenceMonth: string }) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    setMessage(null);
    startTransition(async () => {
      const result = await closePayouts(competenceMonth);
      if (!result.success) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      const skippedNote = result.skipped.length > 0 ? ` · não incluídos: ${result.skipped.join(", ")}` : "";
      setMessage({ kind: "success", text: `${result.closedCount} repasse(s) fechado(s)${skippedNote}.` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClose} disabled={isPending} className="btn btn-primary">
        {isPending ? "Fechando…" : "Fechar repasses do mês"}
      </button>
      {message && (
        <p className="text-xs" style={{ color: message.kind === "error" ? "var(--status-falta)" : "var(--color-accent-2-600)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
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
  competenceMonth,
}: {
  repasseRows: RepasseRow[];
  glosaRows: GlosaRow[];
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
