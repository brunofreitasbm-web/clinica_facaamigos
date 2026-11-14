"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { useCurrentUser } from "@/components/current-user-context";
import { CHAT_FAB_HREF, formatBadgeCount, shouldShowChatFab } from "@/lib/chat-fab-pure";
import { countWaiting } from "@/lib/atendimento/waiting";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

/** Rede de segurança caso o Realtime caia: reconta a cada minuto. */
const POLL_MS = 60_000;

/**
 * Botão flutuante (canto inferior direito) que abre a Central de Atendimento
 * em outra aba. Montado uma única vez no root layout; a visibilidade por
 * papel e rota vem de `shouldShowChatFab`.
 */
export function ChatFab() {
  const user = useCurrentUser();
  const pathname = usePathname();

  if (!shouldShowChatFab(user?.role, pathname)) return null;
  return <ChatFabButton />;
}

/** Só monta (e assina o Realtime) quando o botão está visível. */
function ChatFabButton() {
  const [waiting, setWaiting] = useState(0);

  const refresh = useCallback(async () => {
    const { data, error } = await createClient()
      .from("twilio_conversations")
      .select("status, last_message_sender, last_inbound_at, last_message_at")
      .eq("clinic_id", DEV_CLINIC_ID)
      .neq("status", "closed");
    // Em erro mantém o número anterior em vez de zerar o balão.
    if (!error && data) setWaiting(countWaiting(data));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 300);
    };

    void refresh();
    const channel = supabase
      .channel("chat-fab-waiting")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "twilio_conversations", filter: `clinic_id=eq.${DEV_CLINIC_ID}` },
        schedule,
      )
      .subscribe();
    const poll = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const label =
    waiting > 0
      ? `Abrir o chat em uma nova aba: ${waiting} ${waiting === 1 ? "conversa aguardando" : "conversas aguardando"} resposta`
      : "Abrir o chat em uma nova aba";

  return (
    <a
      href={CHAT_FAB_HREF}
      target="_blank"
      rel="noopener"
      aria-label={label}
      title={waiting > 0 ? `Chat: ${waiting} aguardando resposta` : "Chat"}
      className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.55)] transition hover:scale-105 hover:bg-[#1ebe5a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E] print:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <MessageCircle className="h-8 w-8" fill="currentColor" strokeWidth={1.5} aria-hidden />
      {waiting > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-none text-white ring-2 ring-white"
        >
          {formatBadgeCount(waiting)}
        </span>
      )}
    </a>
  );
}
