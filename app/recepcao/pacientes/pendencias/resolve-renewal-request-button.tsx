"use client";

import { useState, useTransition } from "react";
import { resolveAuthorizationRenewalRequest } from "./authorization-renewal-actions";

/**
 * Ação da fila de pendências pra solicitação de renovação de guia aberta
 * automaticamente (refresh_authorization_renewal_requests). A recepção
 * clica aqui só depois de já ter cadastrado a nova guia na
 * AutorizacaoWizard — isso confirma que a família já está coberta de novo.
 */
export function ResolveRenewalRequestButton({ requestId }: { requestId: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs font-medium text-status-positive-text">✓ Guia renovada</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await resolveAuthorizationRenewalRequest(requestId);
            if (result.success) setDone(true);
            else setError(result.error ?? "Erro ao registrar.");
          });
        }}
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Guia nova já cadastrada"}
      </button>
      {error && <p className="text-[11px] text-status-negative-text">{error}</p>}
    </div>
  );
}
