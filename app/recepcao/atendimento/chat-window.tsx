"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendManualMessage } from "./actions";
import { ChatHeader } from "./chat-header";
import { QuickResponsesPopover } from "./quick-responses-popover";
import type { ConversationRow } from "./atendimento-shell";

type MessageRow = {
  id: string;
  senderType: string;
  direction: string;
  body: string | null;
  sentAt: string | null;
  deliveryStatus: string | null;
};

export function ChatWindow({ conversation }: { conversation: ConversationRow }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQuickResponses, setShowQuickResponses] = useState(false);
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
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const m = payload.new as {
            id: string;
            sender_type: string;
            direction: string;
            body: string | null;
            sent_at: string | null;
            delivery_status: string | null;
          };
          setMessages((prev) => [
            ...prev,
            {
              id: m.id,
              senderType: m.sender_type,
              direction: m.direction,
              body: m.body,
              sentAt: m.sent_at,
              deliveryStatus: m.delivery_status,
            },
          ]);
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

  const handleSendText = (textToSend: string, isRetry = false) => {
    const body = textToSend.trim();
    if (!body || isPending) return;
    setErrorMessage(null);
    if (!isRetry) {
      setDraft("");
    }
    startTransition(async () => {
      const result = await sendManualMessage(conversation.id, body);
      if (!result.success) {
        setErrorMessage(result.error || "Falha ao enviar mensagem via Twilio.");
        if (!isRetry) {
          setDraft(body); // Preserva o rascunho se o envio inicial falhou
        }
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <ChatHeader conversation={conversation} />

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m) => {
          const isOutbound = m.direction === "outbound";
          const isFailed = m.deliveryStatus === "failed";

          return (
            <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[70%] rounded-lg px-3 py-2 text-sm"
                style={{
                  background: isOutbound
                    ? isFailed
                      ? "#dc2626"
                      : "var(--color-accent)"
                    : "var(--color-neutral-100)",
                  color: isOutbound ? "#fff" : "var(--color-ink)",
                }}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div
                  className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-85"
                  style={{ color: isOutbound ? "rgba(255,255,255,0.9)" : "var(--color-ink-faint)" }}
                >
                  <span>
                    {m.sentAt ? new Date(m.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    {isOutbound && m.deliveryStatus
                      ? ` · ${isFailed ? "⚠️ Falhou no envio" : m.deliveryStatus}`
                      : ""}
                  </span>
                  {isOutbound && isFailed && m.body && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSendText(m.body!, true)}
                      className="font-bold underline hover:opacity-100 disabled:opacity-50"
                    >
                      Reenviar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-sm text-ink-faint">Nenhuma mensagem ainda.</p>}
        <div ref={bottomRef} />
      </div>

      <div className="relative border-t border-paper-line-strong p-3">
        {errorMessage && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="ml-2 font-bold text-red-600 hover:underline dark:text-red-400"
            >
              Fechar
            </button>
          </div>
        )}

        {showQuickResponses && (
          <QuickResponsesPopover
            filter={draft}
            onSelect={(contentText) => setDraft(contentText)}
            onClose={() => setShowQuickResponses(false)}
          />
        )}
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Digite uma mensagem ou / para respostas rápidas"
            value={draft}
            disabled={isPending}
            onChange={(e) => {
              const value = e.target.value;
              setDraft(value);
              setShowQuickResponses(value.startsWith("/"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText(draft);
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-icon"
            disabled={isPending || !draft.trim()}
            onClick={() => handleSendText(draft)}
            aria-label="Enviar mensagem"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
