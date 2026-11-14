"use client";

import { useState } from "react";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { buildFaltaFormData, DEFAULT_NEGATIVE_STATUS, reasonNeedsDetail } from "@/lib/falta-quick-pure";

type Result = { success: true } | { success: false; error: string };

/**
 * Painel de falta/cancelamento na linha da sessão. Caso comum em 2 cliques:
 * abrir o painel e tocar no motivo (o status "Falta da família" já vem marcado).
 * Mudar o status é opcional; "Outro" pede o texto e então confirma.
 */
export function FaltaQuickPanel({
  disabled,
  onSubmit,
  onClose,
}: {
  disabled: boolean;
  onSubmit: (formData: FormData) => Promise<Result>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>(DEFAULT_NEGATIVE_STATUS);
  const [askDetail, setAskDetail] = useState(false);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(reason: string, text?: string) {
    const built = buildFaltaFormData({ status, reason, detail: text });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    const result = await onSubmit(built.formData);
    if (!result.success) setError(result.error);
  }

  const chip = "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600";

  return (
    <div className="mt-2 flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2.5" role="group" aria-label="Registrar falta ou cancelamento">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="O que aconteceu">
        {NEGATIVE_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={status === s.value}
            disabled={disabled}
            onClick={() => setStatus(s.value)}
            className={`${chip} ${status === s.value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!askDetail ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-600">Qual o motivo? Toque para registrar.</span>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                disabled={disabled}
                onClick={() => (reasonNeedsDetail(r.value) ? setAskDetail(true) : submit(r.value))}
                className={`${chip} border-slate-300 bg-white text-slate-800 hover:border-rose-300 hover:bg-rose-50`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            type="text"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit("outro", detail);
              }
            }}
            placeholder="Descreva o motivo"
            className="input text-xs"
          />
          <div className="flex gap-1.5">
            <button type="button" disabled={disabled} onClick={() => submit("outro", detail)} className="btn btn-primary text-xs">
              Registrar
            </button>
            <button type="button" onClick={() => setAskDetail(false)} className="btn btn-secondary text-xs">
              Voltar
            </button>
          </div>
        </div>
      )}

      {error && <p className="m-0 text-[11px] text-status-negative-text">{error}</p>}
      <button type="button" onClick={onClose} className="self-start text-[11px] font-medium text-slate-500 underline decoration-dotted hover:text-slate-800">
        Fechar
      </button>
    </div>
  );
}
