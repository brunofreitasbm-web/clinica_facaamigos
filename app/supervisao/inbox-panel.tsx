"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveMessage, sendReply } from "./inbox-actions";

export type InboxMessageRow = {
  id: string;
  patientId: string;
  guardianId: string | null;
  patientName: string;
  body: string;
  whenLabel: string;
  resolved: boolean;
};

export function InboxPanel({ messages }: { messages: InboxMessageRow[] }) {
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
    </section>
  );
}
