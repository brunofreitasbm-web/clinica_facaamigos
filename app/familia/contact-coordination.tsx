"use client";

import { useState, useTransition, useMemo } from "react";
import { sendCoordinationMessage } from "./actions";

/**
 * Valida o texto da mensagem impedindo envios com lixo semântico,
 * floods de caracteres repetidos e strings sem sentido.
 */
function getMessageValidationError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null; // Não exibe erro enquanto está em branco, apenas mantém botão desabilitado
  }
  if (trimmed.length < 3) {
    return "A mensagem deve ter pelo menos 3 caracteres.";
  }
  if (trimmed.length > 2000) {
    return "A mensagem é muito longa (máximo de 2000 caracteres).";
  }

  // Detecta repetição exagerada de uma mesma letra/caractere (ex: "yyyyyyyyy", "aaaaaaaaa", ".....")
  const hasSingleCharFlood = /^(.)\1{4,}$/i.test(trimmed);
  
  // Detecta sequências curtas repetidas sem espaço contínuas (ex: "abcabcabcabcabc")
  const hasPatternFlood = /^(.{1,4})\1{4,}$/i.test(trimmed);

  // Detecta ausência total de letras/números válidos ou apenas pontuação/símbolos repetidos
  const hasNoCoherentWords = !/[a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/i.test(trimmed);

  if (hasSingleCharFlood || hasPatternFlood || hasNoCoherentWords) {
    return "A mensagem inserida parece inválida. Por favor, digite um texto legível.";
  }

  return null;
}

/**
 * "Fale com a Coordenação" — formulário modal com validação rigorosa de input
 * para impedir envio de "lixo" e caracteres repetidos.
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const validationError = useMemo(() => getMessageValidationError(body), [body]);
  const isValid = useMemo(() => {
    const trimmed = body.trim();
    return trimmed.length >= 3 && trimmed.length <= 2000 && validationError === null;
  }, [body, validationError]);

  function close() {
    setOpen(false);
    setServerError(null);
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Escreva sua mensagem…"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setServerError(null);
                    }}
                    disabled={isPending}
                    aria-invalid={!!validationError}
                    style={{
                      borderColor: validationError ? "var(--status-falta)" : undefined,
                    }}
                  />
                  {validationError && (
                    <p style={{ fontSize: 12, color: "var(--status-falta)", margin: 0, fontWeight: 500 }}>
                      ⚠️ {validationError}
                    </p>
                  )}
                  {serverError && (
                    <p style={{ fontSize: 12, color: "var(--status-falta)", margin: 0, fontWeight: 500 }}>
                      ❌ {serverError}
                    </p>
                  )}
                </div>
                <div className="dialog-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={close}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-gold"
                    disabled={!isValid || isPending}
                    onClick={() => {
                      if (!isValid) return;
                      setServerError(null);
                      startTransition(async () => {
                        const result = await sendCoordinationMessage(patientId, guardianId, body);
                        if (!result.success) {
                          setServerError(result.error);
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

