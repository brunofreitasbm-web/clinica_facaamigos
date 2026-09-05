"use client";

import { useState, useTransition } from "react";
import { sendCoordinationMessage } from "./actions";

/**
 * "Fale com a Coordenação" (Familia.dc.html) — botão no header navy que
 * abre um bottom-sheet simples (aqui, um dialog centralizado reaproveitando
 * .dialog/.dialog-backdrop já definidos em globals.css) com um textarea.
 * Ao enviar, grava uma linha real em `messages` (channel='portal',
 * direction='inbound') — ver app/familia/actions.ts para o porquê desses
 * valores. Isso aparece na caixa de entrada da coordenação (tela que outro
 * agente está construindo em paralelo).
 */
export function ContactCoordination({
  patientId,
  guardianId,
}: {
  patientId: string;
  guardianId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
    setBody("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--color-paper)",
          opacity: 0.85,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        💬 Fale com a Coordenação
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Fale com a Coordenação</div>
            {sent ? (
              <>
                <p className="dialog-body">
                  Mensagem enviada. A coordenação responde por aqui ou por
                  telefone.
                </p>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-primary" onClick={close}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="dialog-body">
                  Dúvidas sobre agenda, frequência ou documentos — a equipe
                  responde em horário comercial.
                </p>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Escreva sua mensagem…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={isPending}
                />
                {error && (
                  <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>
                )}
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={close}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-gold"
                    disabled={isPending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await sendCoordinationMessage(patientId, guardianId, body);
                        if (!result.success) {
                          setError(result.error);
                          return;
                        }
                        setSent(true);
                      });
                    }}
                  >
                    {isPending ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
