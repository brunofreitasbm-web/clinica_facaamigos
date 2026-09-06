"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
          <h2 className="text-xl font-bold mb-2 text-rose-600">Erro no Sistema</h2>
          <p className="text-sm text-slate-600 mb-6">
            Ocorreu um erro crítico de renderização. Clique abaixo para recarregar a página.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Recarregar Aplicação
          </button>
        </div>
      </body>
    </html>
  );
}
