"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary local da ficha do paciente. Sem isso, qualquer falha aqui
 * subia até o app/error.tsx da raiz, cuja tela genérica não diz qual rota
 * falhou — o que atrasou o diagnóstico do React #441 desta tela (ver
 * histórico de commits em app/recepcao/pacientes/[id]/page.tsx).
 */
export default function PatientPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Ficha de paciente] Erro na página:", error);
    if (error?.digest) {
      console.error("[Ficha de paciente] Digest do erro de servidor:", error.digest);
    }
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-10 text-center">
      <div className="card max-w-[540px] w-full p-8 flex flex-col items-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold mb-4"
          style={{ background: "var(--color-accent-100)", color: "var(--color-accent-700)" }}
        >
          !
        </div>
        <h2 className="text-xl font-bold mb-2 text-ink">Não foi possível abrir a ficha</h2>
        <p className="text-sm text-ink-soft mb-6 max-w-[420px]">
          Ocorreu um erro ao carregar os dados deste paciente. Tente novamente; se persistir,
          avise a equipe técnica{error.digest ? ` (código ${error.digest})` : ""}.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button type="button" onClick={() => reset()} className="btn btn-primary">
            Tentar novamente
          </button>
          <Link href="/recepcao/pacientes" className="btn btn-ghost">
            ← Voltar para pacientes
          </Link>
        </div>
      </div>
    </main>
  );
}
