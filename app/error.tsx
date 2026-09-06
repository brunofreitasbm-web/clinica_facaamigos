"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na página:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-paper rounded-xl shadow-lg border border-paper-line-strong p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-bold mb-2 text-ink">Ops! Ocorreu um erro</h2>
        <p className="text-sm text-ink-soft mb-6">
          Não foi possível carregar esta página. Tente recarregar ou volte para a tela inicial.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-chart text-paper rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Tentar novamente
          </button>
          <a
            href="/login"
            className="px-4 py-2 bg-paper-darker text-ink rounded-lg text-sm font-medium border border-paper-line-strong hover:bg-paper-line transition-colors"
          >
            Voltar para Login
          </a>
        </div>
      </div>
    </div>
  );
}
