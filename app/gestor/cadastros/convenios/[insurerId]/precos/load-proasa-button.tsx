"use client";

import { useTransition } from "react";
import { loadDefaultProasaCatalogAction } from "./actions";

export function LoadDefaultProasaButton({ insurerId }: { insurerId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await loadDefaultProasaCatalogAction(insurerId);
        });
      }}
      className="inline-flex items-center gap-2 rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {isPending ? "Carregando tabela..." : "⚡ Carregar Tabela de Preços do Contrato PROASA (21 Procedimentos)"}
    </button>
  );
}
