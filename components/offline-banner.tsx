"use client";

import { useOffline } from "next/offline";

/**
 * Banner global de conectividade (PRD §6/§9.4: app do terapeuta precisa ser
 * offline-tolerant). Com `experimental.useOffline` (next.config.ts), o
 * próprio Next.js retém e reenvia Server Actions em andamento quando a rede
 * volta — este banner só torna esse estado visível, para o usuário não achar
 * que a evolução "sumiu" ao perder conexão em atendimento.
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium"
      style={{ background: "var(--color-status-negative-soft)", color: "var(--color-status-negative-text)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      Sem conexão — o que você preencher fica salvo neste aparelho e é enviado assim que a internet voltar.
    </div>
  );
}
