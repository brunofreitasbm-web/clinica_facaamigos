"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendManualMessage } from "./actions";
import { ChatHeader } from "./chat-header";
import { ChatBubble } from "@/src/components/Reception/Chat/ChatBubble";
import { MessageInput } from "@/src/components/Reception/Chat/MessageInput";
import { isWhatsappWindowClosed, type ConversationPatch, type ConversationRow } from "./atendimento-shell";

type MessageRow = {
  id: string;
  senderType: string;
  direction: string;
  body: string | null;
  sentAt: string | null;
  deliveryStatus: string | null;
  mediaUrl: string | null;
  channel: string | null;
};

const MESSAGE_PAGE_SIZE = 50;

const MESSAGE_SELECT = "id, sender_type, direction, body, sent_at, delivery_status, media_url, channel";

function toMessageRow(m: {
  id: string;
  sender_type: string;
  direction: string;
  body: string | null;
  sent_at: string | null;
  delivery_status: string | null;
  media_url: string | null;
  channel?: string | null;
}): MessageRow {
  return {
    id: m.id,
    senderType: m.sender_type,
    direction: m.direction,
    body: m.body,
    sentAt: m.sent_at,
    deliveryStatus: m.delivery_status,
    mediaUrl: m.media_url,
    channel: m.channel ?? null,
  };
}

export function ChatWindow({
  conversation,
  currentUserId,
  staffNames,
  onPatch,
}: {
  conversation: ConversationRow;
  currentUserId: string | null;
  staffNames: Record<string, string>;
  onPatch: (patch: ConversationPatch) => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  // Conversas antigas (anos de histórico com um lead que virou paciente)
  // carregavam TODAS as mensagens de uma vez — só as últimas
  // MESSAGE_PAGE_SIZE entram no primeiro carregamento; "carregar
  // anteriores" busca o resto por sob demanda.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  // "carregar anteriores" também muda messages.length, mas prepende no topo
  // — sem essa flag, o efeito de auto-scroll (abaixo) arrastava a rolagem
  // pra baixo de novo a cada página antiga carregada.
  const skipAutoScrollRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []).map(toMessageRow).reverse();
        setMessages(rows);
        setHasMore(rows.length === MESSAGE_PAGE_SIZE);
      });

    const channel = supabase
      .channel(`atendimento-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const raw = payload.new as Parameters<typeof toMessageRow>[0] | null;
          if (!raw || !raw.id) return;
          const m = toMessageRow(raw);

          setMessages((prev) => {
            const idx = prev.findIndex((item) => item.id === m.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = m;
              return updated;
            }
            return [...prev, m];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  const loadOlderMessages = useCallback(async () => {
    const oldest = messages[0]?.sentAt;
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversation.id)
        .lt("sent_at", oldest)
        .order("sent_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      const older = (data ?? []).map(toMessageRow).reverse();
      skipAutoScrollRef.current = true;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length === MESSAGE_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [conversation.id, messages, loadingMore]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSendText = useCallback(
    async (textToSend: string, isRetry = false): Promise<{ success: boolean; error?: string; warning?: string }> => {
      const body = textToSend.trim();
      if (!body) return { success: false, error: "Mensagem vazia." };

      // Humano respondendo manualmente: pausa a IA na hora, sem esperar o
      // round-trip do servidor nem um clique separado no toggle.
      onPatch({ isBotActive: false });

      return new Promise((resolve) => {
        startTransition(async () => {
          const result = await sendManualMessage(conversation.id, body);
          if (!result.success) {
            resolve({ success: false, error: result.error || "Falha ao enviar mensagem via Twilio." });
          } else {
            resolve({ success: true, warning: result.warning });
          }
        });
      });
    },
    [conversation.id, onPatch],
  );

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        staffNames={staffNames}
        onPatch={onPatch}
      />

      <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              className="btn btn-ghost text-xs disabled:opacity-50"
              disabled={loadingMore}
              onClick={loadOlderMessages}
            >
              {loadingMore ? "Carregando…" : "Carregar mensagens anteriores"}
            </button>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            isPending={isPending}
            onRetry={(body) => handleSendText(body, true)}
          />
        ))}
        {messages.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma mensagem ainda.</p>}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        key={conversation.id}
        conversationId={conversation.id}
        isPending={isPending}
        onSend={handleSendText}
        contactName={conversation.contactName}
        guardianName={conversation.guardianName}
        windowClosed={isWhatsappWindowClosed(conversation)}
      />
    </div>
  );
}
