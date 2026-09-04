"use client";

import { useState, useTransition } from "react";
import {
  generateDevolutionDraft,
  saveDraftText,
  approveDevolutionReport,
  sendDevolutionReport,
} from "./actions";

export type DraftReportView = {
  id: string;
  periodStart: string;
  periodEnd: string;
  aiDraft: string | null;
  finalText: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  gerado: "Rascunho gerado — revise antes de aprovar",
  em_revisao: "Em revisão",
  aprovado: "Aprovado — pronto para enviar",
  enviado: "Enviado à família",
};

export function ReportEditor({
  patientId,
  latestReport,
}: {
  patientId: string;
  latestReport: DraftReportView | null;
}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [report, setReport] = useState<DraftReportView | null>(latestReport);
  const [finalText, setFinalText] = useState(latestReport?.finalText ?? "");
  const [periodStart, setPeriodStart] = useState(thirtyDaysAgo);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = report && (report.status === "gerado" || report.status === "em_revisao");
  const canApprove = canEdit;
  const canSend = report?.status === "aprovado";

  function handleGenerate() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await generateDevolutionDraft(patientId, periodStart, periodEnd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReport({
        id: result.reportId,
        periodStart,
        periodEnd,
        aiDraft: result.draft,
        finalText: result.draft,
        status: "gerado",
      });
      setFinalText(result.draft);
    });
  }

  function handleSave() {
    if (!report) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveDraftText(patientId, report.id, finalText);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReport({ ...report, finalText, status: "em_revisao" });
      setNotice("Edição salva.");
    });
  }

  function handleApprove() {
    if (!report) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await approveDevolutionReport(patientId, report.id, finalText);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReport({ ...report, finalText, status: "aprovado" });
    });
  }

  function handleSend() {
    if (!report) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await sendDevolutionReport(patientId, report.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReport({ ...report, status: "enviado" });
      setNotice("Publicado no mural da família.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="block text-xs text-ink-faint">Período — de</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">até</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          className="self-end rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Gerando…" : "Gerar rascunho com IA"}
        </button>
      </div>

      {error && <p className="text-sm text-status-negative-text">{error}</p>}
      {notice && <p className="text-sm text-status-positive-text">{notice}</p>}

      {report && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Rascunho da IA</h2>
            <p className="mt-1 text-xs text-ink-faint">
              {report.periodStart} a {report.periodEnd} — {STATUS_LABEL[report.status] ?? report.status}
            </p>
            <div className="mt-3 whitespace-pre-wrap rounded-md border border-paper-line-strong bg-paper/60 p-4 text-sm text-ink-soft">
              {report.aiDraft || "—"}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Versão final (editável)</h2>
            <textarea
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              disabled={!canEdit || isPending}
              rows={14}
              className="mt-3 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm disabled:opacity-70"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canEdit || isPending}
                onClick={handleSave}
                className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink disabled:opacity-50"
              >
                Salvar edição
              </button>
              <button
                type="button"
                disabled={!canApprove || isPending}
                onClick={handleApprove}
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={!canSend || isPending}
                onClick={handleSend}
                className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
              >
                {report.status === "enviado" ? "Já enviado" : "Enviar ao mural da família"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
