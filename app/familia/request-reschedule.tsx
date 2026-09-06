"use client";

import { useState, useTransition } from "react";
import { requestReschedule } from "./actions";

/**
 * "Pedir remarcação" (PRD §3.4) — mesmo padrão de dialog de
 * report-absence.tsx/contact-coordination.tsx (.dialog/.dialog-backdrop de
 * globals.css). Só texto livre: a recepção decide o novo horário depois de
 * ler o pedido, o portal não tenta oferecer uma grade de horários aqui.
 */
export function RequestReschedule({
  appointmentId,
  sessionLabel,
}: {
  appointmentId: string;
  sessionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
    setMessage("");
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ minHeight: 40, fontSize: 13, gap: 6 }}
        onClick={() => setOpen(true)}
      >
        <span>🔄</span> Pedir remarcação
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title flex items-center justify-between">
              <span>Pedir Remarcação</span>
            </div>

            {sessionLabel && (
              <div
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  fontSize: 13,
                  marginBottom: 14,
                  borderLeft: "4px solid var(--color-accent-2)",
                }}
              >
                <span className="font-semibold block text-xs text-ink-soft">SESSÃO SELECIONADA:</span>
                <span className="font-medium text-ink-strong">{sessionLabel}</span>
              </div>
            )}

            {sent ? (
              <>
                <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 mb-4 text-emerald-900 text-sm">
                  <p className="font-semibold mb-1">✓ Pedido enviado!</p>
                  <p className="text-xs text-emerald-800">
                    A recepção recebeu sua solicitação e vai entrar em contato para combinar o novo horário.
                  </p>
                </div>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-primary" onClick={close}>
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!message.trim()) {
                    setError("Descreva o que você gostaria de remarcar.");
                    return;
                  }
                  setError(null);
                  startTransition(async () => {
                    const result = await requestReschedule(appointmentId, message);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setSent(true);
                  });
                }}
              >
                <div className="field">
                  <label className="font-semibold text-xs text-ink-soft mb-1 block">
                    O que você gostaria de remarcar? *
                  </label>
                  <textarea
                    name="message"
                    className="input text-xs"
                    rows={3}
                    placeholder="Ex.: Gostaria de remarcar a sessão do dia 15 para o dia 20, de manhã."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

                <div className="dialog-actions pt-2 border-t border-gray-100">
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={isPending}>
                    {isPending ? "Enviando..." : "Enviar pedido"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
