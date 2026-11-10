"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ChaseKey } from "@/lib/lead-pendencies";
import { buildChaseMessage } from "@/lib/intake-actions-pure";
import { buildDocumentsOpenerMessage } from "@/lib/document-request-templates";
import { openDocumentConversation, requestMissingDocuments } from "../pacientes/pendencias/document-request-actions";

/**
 * "Cobrar o que falta": mostra a mensagem única pronta para a recepção conferir e só então envia
 * pelo WhatsApp (Twilio, pelo servidor). É a única ação da Fila de entrada que pede confirmação,
 * porque mensagem enviada não se desfaz.
 *
 * Se não há conversa aberta com o número (a família nunca escreveu ou a janela de 24 h fechou), o
 * envio livre é recusado; aí o diálogo oferece a mensagem de abertura (modelo aprovado), também
 * com o texto à mostra antes de enviar.
 */
export function ChaseAllDialog({
  draftId,
  keys,
  patientName,
  onClose,
  onSent,
}: {
  draftId: string;
  keys: ChaseKey[];
  patientName: string | null;
  onClose: () => void;
  /** Envio feito; `warning` quando ficou só registrado (ambiente sem KYC). */
  onSent: (info: { warning?: string; opener: boolean }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [offerOpener, setOfferOpener] = useState(false);
  const [isPending, startTransition] = useTransition();
  const message = buildChaseMessage(keys, patientName);
  const openerMessage = buildDocumentsOpenerMessage(patientName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPending, onClose]);

  const send = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestMissingDocuments(draftId, keys, patientName);
      if (!res.success) {
        setError(res.error);
        if (res.error.includes("Nenhuma conversa")) setOfferOpener(true);
        return;
      }
      onSent({ warning: res.warning, opener: false });
    });
  };

  const sendOpener = () => {
    setError(null);
    startTransition(async () => {
      const res = await openDocumentConversation(draftId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSent({ opener: true });
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chase-all-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="chase-all-title" className="m-0 text-base font-semibold text-slate-900">
              {offerOpener ? "Abrir a conversa com a família" : "Cobrar o que falta"}
            </h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600">
              Confira a mensagem antes de enviar pelo WhatsApp. Mensagem enviada não se desfaz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Fechar"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-xl text-slate-600 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <pre className="m-0 whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 font-sans text-sm text-slate-900">
          {offerOpener ? openerMessage : message}
        </pre>

        {error && (
          <p role="alert" className="m-0 text-sm text-rose-700">
            {error}
            {offerOpener ? " Envie a mensagem de abertura acima; quando a família responder, cobre os documentos." : ""}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={offerOpener ? sendOpener : send}
            disabled={isPending || (!offerOpener && message === "")}
            className="inline-flex min-h-10 items-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Enviando…" : offerOpener ? "Enviar mensagem de abertura" : "Enviar pelo WhatsApp"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
