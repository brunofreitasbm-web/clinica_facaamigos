"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { actionConfirms } from "@/lib/fila/fila-action-policy-pure";
import { buildMissingDocumentMessage, findMissingDocumentTemplate } from "@/lib/document-request-templates";
import { requestMissingDocument } from "../pacientes/pendencias/document-request-actions";

/**
 * "Pedir este" numa linha de documento: cobra UM documento específico (o "Pedir documentos à família" do
 * próximo passo manda todos os que faltam). Mesma ação de Autorizações (requestMissingDocument) e mesma
 * política da Fila: vai por WhatsApp, então mostra a mensagem e só envia depois da confirmação.
 */
export function FilaDocRequest({
  draftId,
  chaseKey,
  patientName,
  lastSentAt,
  locked,
}: {
  draftId: string;
  chaseKey: string;
  patientName: string | null;
  /** Último pedido deste documento (null: nunca pedido). */
  lastSentAt: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const template = findMissingDocumentTemplate(chaseKey);
  if (!template) return null;

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestMissingDocument(draftId, chaseKey);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setOpen(false);
        toast(`Pedido de ${template.label.toLowerCase()} enviado à família.`, "success");
        router.refresh();
      } catch (err) {
        console.error("[fila] pedido de documento falhou:", err);
        setError("Não foi possível enviar. Confira o histórico antes de repetir, para não enviar duas vezes.");
      }
    });
  };

  const onAsk = () => {
    setError(null);
    if (actionConfirms("ask_documents")) setOpen(true);
    else send();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {lastSentAt && <span className="text-sm text-ink-soft">pedido em {fmtDateTime(lastSentAt, CLINIC_TIMEZONE)}</span>}
        {!open && (
          <button type="button" disabled={isPending || locked} onClick={onAsk} className="btn btn-secondary min-h-10 text-[15px]">
            {lastSentAt ? "Pedir de novo" : "Pedir este"}
          </button>
        )}
      </div>
      {open && (
        <div role="group" aria-label={`Conferir o pedido de ${template.label} antes de enviar`} className="flex flex-col gap-2 rounded-xl border border-paper-line-strong bg-white p-3 text-ink">
          <p className="m-0 text-sm text-ink-soft">Vai por WhatsApp para a família. Mensagem enviada não pode ser desfeita.</p>
          <p className="m-0 whitespace-pre-wrap text-base">{buildMissingDocumentMessage(template, patientName)}</p>
          {error && (
            <p role="alert" className="m-0 text-sm text-status-negative-text">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={isPending || locked} onClick={send} className="btn btn-primary min-h-10 gap-2 text-[15px]">
              {isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Enviar mensagem
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="btn btn-ghost min-h-10 text-[15px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {!open && error && (
        <p role="alert" className="m-0 text-sm text-status-negative-text">
          {error}
        </p>
      )}
    </div>
  );
}
