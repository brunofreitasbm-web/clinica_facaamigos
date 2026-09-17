"use client";

import { useState, useTransition } from "react";
import { loadDefaultProasaCatalogAction } from "./actions";

export function LoadDefaultProasaButton({ insurerId }: { insurerId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await loadDefaultProasaCatalogAction(insurerId);
            if (!result.success) {
              setError(result.error);
            }
          });
        }}
        className="inline-flex items-center gap-2 rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Carregando tabela..." : "⚡ Carregar Tabela de Preços do Contrato PROASA (21 Procedimentos)"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
