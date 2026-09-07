"use client";

import { useState, useTransition } from "react";
import { setInsurerIntakeProfile } from "@/app/gestor/convenios/actions";
import { INTAKE_FIELD_LABEL, type IntakeExtractionProfile, type IntakeFieldKey } from "@/lib/insurance-intake-profile";

const FIELD_OPTIONS = Object.entries(INTAKE_FIELD_LABEL) as [IntakeFieldKey, string][];

/**
 * Editor do "perfil de extração por convênio" — cada plano de saúde manda o
 * PDF de encaminhados num layout diferente; aqui o supervisor/gestor
 * registra dicas (uma vez só) que ajudam o Gemini a ler aquele layout
 * específico (lib/insurance-intake-extraction.ts). Nada aqui é obrigatório:
 * sem perfil configurado, a extração ainda funciona com o prompt genérico.
 */
export function IntakeProfileDialog({
  insurerId,
  insurerName,
  initialProfile,
  onClose,
}: {
  insurerId: string;
  insurerName: string;
  initialProfile: IntakeExtractionProfile;
  onClose: () => void;
}) {
  const [layoutHints, setLayoutHints] = useState(initialProfile.layout_hints ?? "");
  const [headerKeywords, setHeaderKeywords] = useState((initialProfile.header_keywords ?? []).join(", "));
  const [defaultDdd, setDefaultDdd] = useState(initialProfile.default_ddd ?? "");
  const [procedureCodeDefault, setProcedureCodeDefault] = useState(initialProfile.procedure_code_default ?? "");
  const [columns, setColumns] = useState(initialProfile.columns ?? []);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function addColumn() {
    setColumns((prev) => [...prev, { key: "patient_full_name" as IntakeFieldKey, label_in_pdf: "" }]);
  }

  function updateColumn(index: number, patch: Partial<{ key: IntakeFieldKey; label_in_pdf: string }>) {
    setColumns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeColumn(index: number) {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    const profile: IntakeExtractionProfile = {
      version: 1,
      layout_hints: layoutHints.trim() || undefined,
      header_keywords: headerKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      default_ddd: defaultDdd.trim() || undefined,
      procedure_code_default: procedureCodeDefault.trim() || undefined,
      columns: columns.filter((c) => c.label_in_pdf.trim().length > 0),
    };
    startTransition(async () => {
      const res = await setInsurerIntakeProfile(insurerId, profile);
      setFeedback(res.success ? { type: "success", text: "Perfil salvo." } : { type: "error", text: res.error });
      if (res.success) setTimeout(onClose, 800);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Campos por plano de saúde — {insurerName}</h3>
          <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-ink">
            Fechar ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-soft">
          Opcional: dicas sobre o layout do PDF que este convênio envia, pra ajudar a IA a ler certo. Sem preencher nada, a extração continua funcionando com um prompt genérico.
        </p>

        {feedback && (
          <div className={`mb-4 rounded-md border p-3 text-xs ${feedback.type === "success" ? "border-status-positive-text/40 bg-status-positive-soft/40 text-status-positive-text" : "border-status-negative-text/40 bg-status-negative-soft/40 text-status-negative-text"}`}>
            {feedback.text}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Dicas de layout</label>
            <textarea
              value={layoutHints}
              onChange={(e) => setLayoutHints(e.target.value)}
              rows={3}
              placeholder='Ex.: "tabela com uma linha por beneficiário; 2ª coluna é a carteirinha"'
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Palavras-chave do cabeçalho (separadas por vírgula)</label>
            <input value={headerKeywords} onChange={(e) => setHeaderKeywords(e.target.value)} placeholder="Ex.: UNIMED, Relação de encaminhados" className="input mt-1 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">DDD padrão (telefones sem DDD)</label>
              <input value={defaultDdd} onChange={(e) => setDefaultDdd(e.target.value)} maxLength={2} className="input mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Código de procedimento padrão</label>
              <input value={procedureCodeDefault} onChange={(e) => setProcedureCodeDefault(e.target.value)} className="input mt-1 w-full" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Mapeamento de colunas</label>
              <button type="button" onClick={addColumn} className="text-xs font-semibold text-chart hover:underline">
                + Adicionar
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {columns.map((col, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select value={col.key} onChange={(e) => updateColumn(index, { key: e.target.value as IntakeFieldKey })} className="input flex-1">
                    {FIELD_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={col.label_in_pdf}
                    onChange={(e) => updateColumn(index, { label_in_pdf: e.target.value })}
                    placeholder="Rótulo no PDF (ex.: Beneficiário)"
                    className="input flex-1"
                  />
                  <button type="button" onClick={() => removeColumn(index)} className="text-xs text-status-negative-text hover:underline">
                    remover
                  </button>
                </div>
              ))}
              {columns.length === 0 && <p className="text-xs text-ink-faint">Nenhuma coluna mapeada ainda.</p>}
            </div>
          </div>

          <button type="button" disabled={isPending} onClick={handleSave} className="rounded-md bg-chart px-4 py-2 text-xs font-semibold text-white hover:bg-chart-strong disabled:opacity-50">
            {isPending ? "Salvando…" : "Salvar perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
