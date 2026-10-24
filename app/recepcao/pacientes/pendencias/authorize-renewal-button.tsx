"use client";

import { useState } from "react";
import type { PendingQueueItem } from "@/lib/reception-queue";
import { RenewalResponseDialog } from "./autorizacao-wizard";

/**
 * "Autorizado" da fila de pendências para renovação de guia já pedida ao
 * plano: abre o mesmo formulário de resposta do plano da AutorizacaoWizard
 * (guia, sessões, vigência), grava a guia nova e abre o WhatsApp com o aviso
 * pronto para o responsável.
 */
export function AuthorizeRenewalButton({
  patientName,
  pending,
}: {
  patientName: string;
  pending: NonNullable<PendingQueueItem["renewalPending"]>;
}) {
  const [open, setOpen] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  if (doneMessage) return <span className="text-[13px] font-medium text-status-positive-text">✓ {doneMessage}</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        Autorizado
      </button>
      {open && (
        <RenewalResponseDialog
          item={{
            patientName,
            insurerName: pending.insurerName,
            specialty: "",
            renewal: {
              id: pending.authorizationId,
              requestedAt: pending.requestedAt,
              sessionsRequested: pending.sessionsRequested,
              validFrom: pending.validFrom,
              validTo: pending.validTo,
            },
          }}
          onClose={() => setOpen(false)}
          onDone={(message) => {
            setOpen(false);
            setDoneMessage(message);
          }}
        />
      )}
    </>
  );
}
