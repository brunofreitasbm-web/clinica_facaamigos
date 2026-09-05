"use client";

import { useState, useTransition } from "react";
import { generateInsurerReport, type InsurerReportHistoryItem } from "./actions";
import { getDocumentUrl } from "@/app/recepcao/pacientes/[id]/documents-actions";

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export function ReportGenerator({
  patientId,
  initialHistory,
}: {
  patientId: string;
  initialHistory: InsurerReportHistoryItem[];
}) {
  const initial = defaultPeriod();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [history, setHistory] = useState(initialHistory);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [viewError, setViewError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">De</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="mt-1 block rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Até</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="mt-1 block rounded-md border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await generateInsurerReport(patientId, periodStart, periodEnd);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setHistory((prev) => [
                { id: result.documentId, uploadedAt: new Date().toLocaleString("pt-BR"), uploadedByName: "Você" },
                ...prev,
              ]);
            });
          }}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Gerando…" : "Gerar PDF"}
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          Relatórios gerados ({history.length})
        </h3>
        <div className="flex flex-col gap-2">
          {history.length === 0 && (
            <p className="text-sm text-ink-faint">Nenhum relatório gerado ainda.</p>
          )}
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
            >
              <span className="text-ink-soft">
                {h.uploadedAt} · {h.uploadedByName}
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewError(null);
                  startTransition(async () => {
                    const result = await getDocumentUrl(h.id);
                    if (!result.success) {
                      setViewError(result.error);
                      return;
                    }
                    window.open(result.url, "_blank", "noopener,noreferrer");
                  });
                }}
                className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart"
              >
                Ver PDF
              </button>
            </div>
          ))}
        </div>
        {viewError && <p className="mt-2 text-xs text-status-negative-text">{viewError}</p>}
      </div>
    </div>
  );
}
