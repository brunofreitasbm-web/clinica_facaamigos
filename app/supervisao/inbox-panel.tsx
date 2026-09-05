"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveMessage, sendReply } from "./inbox-actions";
import { approveReportFromSupervisao } from "./report-review-actions";

export type InboxMessageRow = {
  id: string;
  patientId: string;
  guardianId: string | null;
  patientName: string;
  body: string;
  whenLabel: string;
  resolved: boolean;
};

export type ReassessmentRow = {
  id: string;
  patientName: string;
  dueDate: string;
  daysLeft: number;
};

export type PendingReportRow = {
  id: string;
  patientId: string;
  patientName: string;
  generatedByName: string;
  text: string;
};

function ReportReviewCard({ report }: { report: PendingReportRow }) {
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (approved) {
    return (
      <div className="flex items-center justify-between p-2.5 rounded bg-emerald-50 border border-emerald-200">
        <span className="text-sm font-medium text-emerald-900">
          {report.patientName} · relatório aprovado
        </span>
      </div>
    );
  }

  return (
    <div className="p-2.5 rounded bg-blue-50 border border-blue-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-medium text-blue-900">{report.patientName} · Relatório devolutivo</span>
          <span className="block text-xs text-blue-700">Gerado por {report.generatedByName}</span>
        </div>
        <button
          type="button"
          disabled={isPending}
          className="btn btn-secondary text-xs"
          style={{ padding: "4px 8px" }}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await approveReportFromSupervisao(report.patientId, report.id, report.text);
              if (result.success) setApproved(true);
              else setError(result.error ?? "Erro ao aprovar.");
            });
          }}
        >
          {isPending ? "Aprovando…" : "Revisar & Aprovar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-blue-800 line-clamp-3 whitespace-pre-wrap">{report.text}</p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function InboxPanel({
  messages,
  reassessments,
  pendingReports,
}: {
  messages: InboxMessageRow[];
  reassessments: ReassessmentRow[];
  pendingReports: PendingReportRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(messages[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(() => messages.find((m) => m.id === selectedId) ?? null, [messages, selectedId]);

  function handleResolve() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await resolveMessage(selected.id);
      if (!result.success) setError(result.error);
    });
  }

  function handleReply() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await sendReply(selected.id, selected.patientId, selected.guardianId, reply);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReply("");
    });
  }

  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-[420px_1fr]">
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }}>Chamados</h6>
        <h1 className="m-0 mb-6">Caixa de entrada</h1>
        {messages.length === 0 ? (
          <p className="text-sm text-ink-faint">Nenhuma mensagem da família pelo portal ainda.</p>
        ) : (
          <div className="flex flex-col">
            {messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className="flex items-start justify-between gap-3 border-b py-3.5 text-left text-sm"
                style={{
                  borderColor: "var(--color-divider)",
                  background: m.id === selectedId ? "var(--color-surface)" : "transparent",
                }}
              >
                <div className="min-w-0">
                  <div className="font-semibold">{m.patientName}</div>
                  <div className="truncate text-xs text-ink-soft">{m.body}</div>
                  <div className="text-xs text-ink-faint">{m.whenLabel}</div>
                </div>
                <span className={`tag-status ${m.resolved ? "st-realizada" : "st-agendada"}`}>
                  {m.resolved ? "Respondido" : "Novo"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {!selected ? (
          <p className="text-sm text-ink-faint">Selecione um chamado na lista ao lado.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }}>{selected.patientName} · portal da família</h6>
                <h2 className="m-0">{selected.whenLabel}</h2>
              </div>
              <button type="button" className="btn btn-primary" disabled={isPending || selected.resolved} onClick={handleResolve}>
                {selected.resolved ? "Resolvido" : "Marcar resolvido"}
              </button>
            </div>
            {error && (
              <p className="mb-3 text-xs" style={{ color: "var(--status-falta)" }}>
                {error}
              </p>
            )}
            <div
              className="mb-6 rounded-sm p-5 text-sm"
              style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)" }}
            >
              {selected.body}
            </div>
            <div className="field mb-3">
              <label>Responder</label>
              <textarea
                className="input"
                placeholder="Escreva a resposta…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={isPending}
              />
            </div>
            <button type="button" className="btn btn-secondary" disabled={isPending || !reply.trim()} onClick={handleReply}>
              Enviar resposta
            </button>
          </>
        )}
      </div>

      {/* Seção de Alertas de Reavaliação e Revisão de Relatórios Clínicos */}
      <div className="col-span-1 lg:col-span-2 border-t pt-8 mt-6 grid grid-cols-1 md:grid-cols-2 gap-8" style={{ borderColor: "var(--color-divider)" }}>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">Ciclo Semestral</h6>
            <span className="tag-status st-agendada">reassessment_alerts</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Alertas de Reavaliação Periódica</h3>
          <p className="text-xs text-ink-soft mb-4">Pacientes com ciclo de plano clínico prestes a expirar.</p>
          <div className="flex flex-col gap-2 text-sm">
            {reassessments.length === 0 && (
              <p className="text-xs text-ink-faint">Nenhuma reavaliação vencendo no momento.</p>
            )}
            {reassessments.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2.5 rounded bg-amber-50 border border-amber-200">
                <div>
                  <span className="font-medium text-amber-900">{r.patientName}</span>
                  <span className="block text-xs text-amber-700">
                    Vencimento em {r.dueDate}
                    {r.daysLeft >= 0 ? ` (${r.daysLeft} dia(s))` : ` (${Math.abs(r.daysLeft)} dia(s) atrasado)`}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-amber-200 text-amber-900 rounded">Pendente</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">Revisão Devolutivo</h6>
            <span className="tag-status st-confirmada">draft_reports</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Relatórios Devolutivos Pendentes</h3>
          <p className="text-xs text-ink-soft mb-4">Relatórios gerados pelos terapeutas aguardando aprovação antes de ir pro mural da família.</p>
          <div className="flex flex-col gap-2 text-sm">
            {pendingReports.length === 0 && (
              <p className="text-xs text-ink-faint">Nenhum relatório aguardando aprovação.</p>
            )}
            {pendingReports.map((r) => (
              <ReportReviewCard key={r.id} report={r} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
