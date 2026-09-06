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
export function ReportAbsence({
  appointmentId,
  sessionLabel,
}: {
  appointmentId: string;
  sessionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
    setReasonCategory("");
    setReasonText("");
    setSelectedFileName(null);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ minHeight: 40, fontSize: 13, gap: 6 }}
        onClick={() => setOpen(true)}
      >
        <span>⚠️</span> Informar ausência da sessão
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title flex items-center justify-between">
              <span>Informar Ausência da Sessão</span>
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
                  <p className="font-semibold mb-1">✓ Ausência Notificada com Sucesso!</p>
                  <p className="text-xs text-emerald-800">
                    O agendamento foi atualizado automaticamente no sistema. A coordenação e o supervisor da clínica já foram notificados em seu quadro de avisos.
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
                  if (!reasonCategory) {
                    setError("Selecione um motivo para a ausência.");
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
                  <label className="font-semibold text-xs text-ink-soft mb-1.5 block">Motivo da Ausência *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ABSENCE_REASON_CATEGORIES.map((c) => (
                      <label
                        key={c.value}
                        className={`flex items-center gap-2 p-2.5 rounded border text-xs cursor-pointer transition-all ${
                          reasonCategory === c.value
                            ? "border-amber-600 bg-amber-50 font-semibold text-amber-900 shadow-sm"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reason_category"
                          value={c.value}
                          checked={reasonCategory === c.value}
                          onChange={() => setReasonCategory(c.value)}
                          className="accent-amber-600"
                        />
                        <span>
                          {c.value === "doenca" && "🩺 "}
                          {c.value === "viagem" && "✈️ "}
                          {c.value === "compromisso" && "📅 "}
                          {c.value === "outro" && "📝 "}
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="font-semibold text-xs text-ink-soft mb-1 block">Observações / Detalhes (opcional)</label>
                  <textarea
                    name="reason_text"
                    className="input text-xs"
                    rows={2}
                    placeholder="Descreva o motivo ou recado para a equipe clínica..."
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                <div className="field">
                  <label className="font-semibold text-xs text-ink-soft mb-1 block">
                    Documento Comprobatório / Atestado (opcional)
                  </label>
                  <div className="relative border border-dashed border-gray-300 rounded-md p-3 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input
                      type="file"
                      name="attachment"
                      accept="image/*,application/pdf"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      disabled={isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setSelectedFileName(file ? file.name : null);
                      }}
                    />
                    <span className="text-xs text-gray-600 block">
                      {selectedFileName ? (
                        <span className="font-semibold text-amber-800">📄 {selectedFileName}</span>
                      ) : (
                        "📎 Clique ou arraste para anexar atestado (PDF, JPG, PNG)"
                      )}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Anexar comprovante ou selecionar doença aprova automaticamente a falta no sistema.
                  </span>
                </div>

                {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

                <div className="dialog-actions pt-2 border-t border-gray-100">
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={isPending}>
                    {isPending ? "Enviando e cancelando..." : "Confirmar Ausência"}
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
