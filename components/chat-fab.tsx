"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { useCurrentUser } from "@/components/current-user-context";
import { CHAT_FAB_HREF, shouldShowChatFab } from "@/lib/chat-fab-pure";

/**
 * Botão flutuante (canto inferior direito) que abre a Central de Atendimento
 * em outra aba. Montado uma única vez no root layout; a visibilidade por
 * papel e rota vem de `shouldShowChatFab`.
 */
export function ChatFab() {
  const user = useCurrentUser();
  const pathname = usePathname();

  if (!shouldShowChatFab(user?.role, pathname)) return null;

  return (
    <a
      href={CHAT_FAB_HREF}
      target="_blank"
      rel="noopener"
      aria-label="Abrir o chat em uma nova aba"
      title="Chat"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#065264] text-white shadow-lg transition hover:scale-105 hover:bg-[#04404f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065264] print:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
    </a>
  );
}
