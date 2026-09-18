"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendManualMessage } from "./actions";
import { ChatHeader } from "./chat-header";
import { ChatBubble } from "@/src/components/Reception/Chat/ChatBubble";
import { MessageInput } from "@/src/components/Reception/Chat/MessageInput";
import type { ConversationPatch, ConversationRow } from "./atendimento-shell";

type MessageRow = {
  id: string;
  senderType: string;
  direction: string;
  body: string | null;
  sentAt: string | null;
  deliveryStatus: string | null;
};

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
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("messages")
      .select("id, sender_type, direction, body, sent_at, delivery_status")
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setMessages(
          (data ?? []).map((m) => ({
            id: m.id,
            senderType: m.sender_type,
            direction: m.direction,
            body: m.body,
            sentAt: m.sent_at,
            deliveryStatus: m.delivery_status,
          })),
        );
      });

    const channel = supabase
      .channel(`atendimento-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const m = payload.new as {
            id: string;
            sender_type: string;
            direction: string;
            body: string | null;
            sent_at: string | null;
            delivery_status: string | null;
          };
          if (!m || !m.id) return;

          setMessages((prev) => {
            const idx = prev.findIndex((item) => item.id === m.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                id: m.id,
                senderType: m.sender_type,
                direction: m.direction,
                body: m.body,
                sentAt: m.sent_at,
                deliveryStatus: m.delivery_status,
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: m.id,
                senderType: m.sender_type,
                direction: m.direction,
                body: m.body,
                sentAt: m.sent_at,
                deliveryStatus: m.delivery_status,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSendText = useCallback(
    async (textToSend: string, isRetry = false): Promise<{ success: boolean; error?: string; warning?: string }> => {
      const body = textToSend.trim();
      if (!body) return { success: false, error: "Mensagem vazia." };

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
    [conversation.id],
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
      />
    </div>
  );
}
