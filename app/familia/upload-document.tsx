"use client";

import { useRef, useState, useTransition } from "react";
import { uploadFamilyDocument } from "./actions";

/**
 * "Enviar documento" (PRD §3.6) — carteirinha atualizada, pedido médico
 * novo, comprovante de residência. Sem seletor de categoria: a Server Action
 * já grava sempre 'familia_envio' (documents_write_family, 20260906000020);
 * o campo `note` é só o rótulo livre que aparece pra recepção revisar.
 */
export function UploadDocument({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
    setSelectedFileName(null);
    formRef.current?.reset();
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ minHeight: 40, fontSize: 13, gap: 6 }}
        onClick={() => setOpen(true)}
      >
        <span>📎</span> Enviar documento
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title flex items-center justify-between">
              <span>Enviar Documento</span>
            </div>

            {sent ? (
              <>
                <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 mb-4 text-emerald-900 text-sm">
                  <p className="font-semibold mb-1">✓ Documento enviado!</p>
                  <p className="text-xs text-emerald-800">
                    A recepção vai conferir e liberar quando processar seu envio.
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
                ref={formRef}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const file = formData.get("file");
                  if (!(file instanceof File) || file.size === 0) {
                    setError("Selecione um arquivo.");
                    return;
                  }
                  setError(null);
                  startTransition(async () => {
                    const result = await uploadFamilyDocument(patientId, formData);
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
                    O que é este documento? (opcional)
                  </label>
                  <input
                    name="note"
                    type="text"
                    className="input text-xs"
                    placeholder="Ex.: Carteirinha do convênio atualizada"
                    maxLength={200}
                    disabled={isPending}
                  />
                </div>

                <div className="field">
                  <label className="font-semibold text-xs text-ink-soft mb-1 block">Arquivo *</label>
                  <div className="relative border border-dashed border-gray-300 rounded-md p-3 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input
                      type="file"
                      name="file"
                      required
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
                        "📎 Clique para escolher um arquivo (PDF, JPG, PNG)"
                      )}
                    </span>
                  </div>
                </div>

                {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

                <div className="dialog-actions pt-2 border-t border-gray-100">
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={isPending}>
                    {isPending ? "Enviando..." : "Enviar"}
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
