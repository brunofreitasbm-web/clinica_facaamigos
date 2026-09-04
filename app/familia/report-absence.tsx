"use client";

import { useState, useTransition } from "react";
import { ABSENCE_REASON_CATEGORIES } from "@/lib/absence-reasons";
import { reportAbsence } from "./actions";

/**
 * "Informar Falta" (PRD §5) — mesmo padrão de dialog de
 * contact-coordination.tsx (reaproveita .dialog/.dialog-backdrop de
 * globals.css). Anexo é opcional pra todas as categorias; a regra de
 * aprovação automática (doença OU anexo) é decidida no banco
 * (absence_report_apply), não aqui — o formulário só coleta os dados.
 */
export function ReportAbsence({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
    setReasonCategory("");
    setReasonText("");
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setOpen(true)}>
        Informar falta
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Informar falta</div>
            {sent ? (
              <>
                <p className="dialog-body">
                  Falta registrada. Se o motivo já foi aprovado automaticamente, a sessão já aparece como
                  falta justificada; caso contrário, a recepção vai analisar.
                </p>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-primary" onClick={close}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reasonCategory) {
                    setError("Selecione um motivo.");
                    return;
                  }
                  setError(null);
                  const formData = new FormData(e.currentTarget);
                  startTransition(async () => {
                    const result = await reportAbsence(appointmentId, formData);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setSent(true);
                  });
                }}
              >
                <div className="field">
                  <label>Motivo</label>
                  <div className="seg">
                    {ABSENCE_REASON_CATEGORIES.map((c) => (
                      <label key={c.value} className="seg-opt">
                        <input
                          type="radio"
                          name="reason_category"
                          value={c.value}
                          checked={reasonCategory === c.value}
                          onChange={() => setReasonCategory(c.value)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Detalhes (opcional)</label>
                  <textarea
                    name="reason_text"
                    className="input"
                    rows={3}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="field">
                  <label>Atestado ou comprovante (opcional)</label>
                  <input type="file" name="attachment" accept="image/*,application/pdf" className="input" disabled={isPending} />
                </div>
                {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={close}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={isPending}>
                    {isPending ? "Enviando…" : "Enviar"}
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
