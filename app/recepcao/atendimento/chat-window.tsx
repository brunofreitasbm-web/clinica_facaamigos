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
  onClosed,
}: {
  conversation: ConversationRow;
  currentUserId: string | null;
  staffNames: Record<string, string>;
  onPatch: (patch: ConversationPatch) => void;
  onClosed?: () => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  // Sem isto "Nenhuma mensagem ainda." piscava a cada troca de conversa,
  // enquanto o fetch ainda estava em andamento.
  const [loaded, setLoaded] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // true enquanto a recepção está perto do fim da conversa. Só nesse caso
  // uma mensagem nova arrasta a rolagem; quem subiu para ler histórico não
  // é puxado de volta.
  const stickToBottomRef = useRef(true);
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
        setLoaded(true);
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
          // A própria resposta sempre leva a rolagem ao fim.
          if (m.direction === "outbound") stickToBottomRef.current = true;

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
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: loaded ? "smooth" : "auto" });
      setHasNewBelow(false);
    } else {
      setHasNewBelow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) setHasNewBelow(false);
  }, []);

  const jumpToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    setHasNewBelow(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
        onClosed={onClosed}
      />

      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full space-y-2 overflow-y-auto px-5 py-4">
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
        {!loaded && (
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
            Carregando mensagens…
          </p>
        )}
        {loaded && messages.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma mensagem ainda.</p>
        )}
        <div ref={bottomRef} />
      </div>
      {hasNewBelow && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          Novas mensagens ↓
        </button>
      )}
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
