"use client";

import { useOffline } from "next/offline";

import { WifiOff } from "lucide-react";

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
      aria-live="polite"
      className="flex min-h-[44px] items-center justify-center gap-2.5 px-4 py-2 text-center text-xs font-semibold shadow-xs animate-fade-in"
      style={{ background: "var(--color-status-negative-soft)", color: "var(--color-status-negative-text)" }}
    >
      <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-status-negative" aria-hidden />
      <span>Sem conexão — o que você preencher fica salvo neste aparelho e é enviado assim que a internet voltar.</span>
    </div>
  );
}
