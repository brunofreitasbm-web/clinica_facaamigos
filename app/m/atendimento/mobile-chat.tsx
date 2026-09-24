"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, CheckCheck, MoreVertical, Paperclip, RefreshCw, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDraftMessage } from "@/src/hooks/useDraftMessage";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import {
  assignConversation,
  sendManualMessage,
  setConversationClosed,
  toggleBotActive,
} from "@/app/recepcao/atendimento/actions";
import type { AttendanceManualOutcome } from "@/lib/conversation-attendance";
import type { ConversationPatch, ConversationRow } from "@/lib/atendimento/types";
import { MobileChatMenu } from "./mobile-chat-menu";
import { ContactSheet } from "./contact-sheet";
import { CloseDialog } from "./close-dialog";

type MessageRow = {
  id: string;
  senderType: string;
  direction: string;
  body: string | null;
  sentAt: string | null;
  deliveryStatus: string | null;
  mediaUrl: string | null;
};

type QuickResponseRow = { id: string; shortcut: string; title: string; contentText: string };

function renderFormattedBody(text: string | null) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
        style={{ color: "var(--color-teal-700)" }}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function ChatBubble({ message, isPending, onRetry }: { message: MessageRow; isPending: boolean; onRetry: (body: string) => void }) {
  const isOutbound = message.direction === "outbound";
  const isFailed = message.deliveryStatus === "failed";
  const isBot = message.senderType === "bot";
  const time = message.sentAt
    ? new Date(message.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  if (isOutbound) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%]"
          style={{
            background: isFailed ? "var(--color-error)" : "var(--color-teal-100)",
            color: isFailed ? "#fff" : "var(--color-text)",
            borderRadius: "16px 16px 4px 16px",
            padding: "8px 12px 6px",
          }}
        >
          {message.mediaUrl && (
            <a
              href={`/api/arquivos/mensagem/${message.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-1 flex items-center gap-1.5 text-[12px] font-bold underline"
            >
              <Paperclip size={13} /> Anexo
            </a>
          )}
          {message.body && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.4]">{renderFormattedBody(message.body)}</p>
          )}
          <div className="mt-1 flex items-center justify-end gap-1 text-[11px]" style={{ color: "var(--color-neutral-500)" }}>
            {isFailed ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => message.body && onRetry(message.body)}
                className="flex items-center gap-1 font-bold underline"
                style={{ color: "#fff" }}
              >
                <RefreshCw size={11} className={isPending ? "animate-spin" : ""} />
                Falhou no envio · Reenviar
              </button>
            ) : (
              <>
                <span>{time}</span>
                <CheckCheck
                  size={14}
                  style={{
                    color:
                      message.deliveryStatus === "read"
                        ? "var(--color-teal-700)"
                        : message.deliveryStatus === "delivered"
                          ? "var(--color-neutral-400)"
                          : "var(--color-neutral-300)",
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[80%]"
        style={{
          background: "#fff",
          borderRadius: "16px 16px 16px 4px",
          padding: "8px 12px 6px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {isBot && (
          <div className="mb-0.5 text-[11px] font-extrabold" style={{ color: "var(--color-accent-2-600)" }}>
            Bot
          </div>
        )}
        {message.mediaUrl && (
          <a
            href={`/api/arquivos/mensagem/${message.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 flex items-center gap-1.5 rounded-[10px] border px-2 py-1.5 text-[12px] font-bold underline"
            style={{ background: "var(--color-bg)", borderColor: "var(--color-paper-line-strong)", color: "var(--color-accent)" }}
          >
            <Paperclip size={13} /> Abrir anexo recebido
          </a>
        )}
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.4]" style={{ color: "var(--color-text)" }}>
            {renderFormattedBody(message.body)}
          </p>
        )}
        <div className="mt-1 text-right text-[11px]" style={{ color: "var(--color-neutral-500)" }}>
          {time}
        </div>
      </div>
    </div>
  );
}

export function MobileChat({
  conversation,
  currentUserId,
  staffNames,
  onBack,
  onPatch,
}: {
  conversation: ConversationRow;
  currentUserId: string | null;
  staffNames: Record<string, string>;
  onBack: () => void;
  onPatch: (patch: ConversationPatch) => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [quickResponses, setQuickResponses] = useState<QuickResponseRow[]>([]);
  const { draft, setDraft, clearDraft } = useDraftMessage(conversation.id, "chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMine = Boolean(currentUserId) && conversation.assignedTo === currentUserId;
  const assigneeName = conversation.assignedTo ? (staffNames[conversation.assignedTo] ?? "outra pessoa") : null;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("messages")
      .select("id, sender_type, direction, body, sent_at, delivery_status, media_url")
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
            mediaUrl: m.media_url,
          })),
        );
      });

    const channel = supabase
      .channel(`m-atendimento-messages-${conversation.id}`)
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
            media_url: string | null;
          };
          if (!m?.id) return;
          const row: MessageRow = {
            id: m.id,
            senderType: m.sender_type,
            direction: m.direction,
            body: m.body,
            sentAt: m.sent_at,
            deliveryStatus: m.delivery_status,
            mediaUrl: m.media_url,
          };
          setMessages((prev) => {
            const idx = prev.findIndex((item) => item.id === row.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = row;
              return updated;
            }
            return [...prev, row];
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
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("quick_responses")
      .select("id, shortcut, title, content_text")
      .order("shortcut")
      .then(({ data }) => {
        if (cancelled) return;
        setQuickResponses((data ?? []).map((r) => ({ id: r.id, shortcut: r.shortcut, title: r.title, contentText: r.content_text })));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rola pro fim sem scrollIntoView (evita "puxar" a página inteira no iOS Safari).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const applyPlaceholders = useCallback(
    (text: string): string => {
      const source = conversation.guardianName ?? conversation.contactName;
      const firstName = source?.trim().split(/\s+/)[0];
      const token = /\{\{?\s*nome\s*\}?\}/gi;
      return firstName ? text.replace(token, firstName) : text.replace(/,?\s*\{\{?\s*nome\s*\}?\}/gi, "");
    },
    [conversation.guardianName, conversation.contactName],
  );

  const handleSend = async (overrideText?: string, isRetry = false) => {
    const body = (overrideText ?? draft).trim();
    if (!body || isPending) return;
    setSendError(null);
    startTransition(async () => {
      const result = await sendManualMessage(conversation.id, body);
      if (!result.success) {
        setSendError(result.error || "Falha ao enviar mensagem.");
        return;
      }
      if (!isRetry) clearDraft();
    });
  };

  const handleAssignToggle = async (shouldAssign: boolean) => {
    setError(null);
    const patch = { assignedTo: shouldAssign ? currentUserId : null, isBotActive: shouldAssign ? false : conversation.isBotActive };
    const revert = { assignedTo: conversation.assignedTo, isBotActive: conversation.isBotActive };
    onPatch(patch);
    const result = await assignConversation(conversation.id, shouldAssign);
    if (!result.success) {
      onPatch(revert);
      setError(result.error ?? "Não foi possível atualizar a conversa.");
    }
  };

  const handleBotToggle = async (shouldEnableBot: boolean) => {
    setError(null);
    const patch = { isBotActive: shouldEnableBot };
    const revert = { isBotActive: conversation.isBotActive };
    onPatch(patch);
    const result = await toggleBotActive(conversation.id, shouldEnableBot);
    if (!result.success) {
      onPatch(revert);
      setError(result.error ?? "Não foi possível atualizar o bot.");
    }
  };

  const handleClose = async (shouldClose: boolean, outcome?: AttendanceManualOutcome, note?: string) => {
    setError(null);
    const patch = shouldClose
      ? { status: "closed", unreadCount: 0, assignedTo: null, isBotActive: true, escalationReason: null }
      : { status: "open" };
    const revert = {
      status: conversation.status,
      unreadCount: conversation.unreadCount,
      assignedTo: conversation.assignedTo,
      isBotActive: conversation.isBotActive,
      escalationReason: conversation.escalationReason,
    };
    onPatch(patch);
    const result = await setConversationClosed(conversation.id, shouldClose, outcome, note);
    if (!result.success) {
      onPatch(revert);
      setError(result.error ?? "Não foi possível atualizar a conversa.");
    }
  };

  const showQuickResponses = draft.startsWith("/");
  const normalizedFilter = draft.replace(/^\//, "").toLowerCase();
  const filteredQuickResponses = quickResponses.filter(
    (r) =>
      r.shortcut.replace(/^\//, "").toLowerCase().startsWith(normalizedFilter) ||
      r.title.toLowerCase().includes(normalizedFilter),
  );

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "var(--color-chat-bg)" }}>
      {/* Header */}
      <header
        className="shrink-0"
        style={{
          background: "var(--color-accent)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingRight: 8,
          paddingBottom: 8,
          paddingLeft: 4,
          boxShadow: "0 1px 4px color-mix(in srgb, var(--color-text) 20%, transparent)",
        }}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Voltar"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
              style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
            >
              {initialsOf(conversation.displayName)}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[16px] font-extrabold text-white">{conversation.displayName}</span>
                {conversation.planName && <HealthPlanBadge name={conversation.planName} color={conversation.planColor} size="md" />}
              </span>
              <span className="block truncate text-[12px]" style={{ color: "color-mix(in srgb, #fff 85%, transparent)" }}>
                {conversation.guardianName ?? conversation.phoneNumber}
                {assigneeName ? ` · com ${isMine ? "você" : assigneeName}` : ""}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Mais opções"
            onClick={() => setMenuOpen(true)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          >
            <MoreVertical size={22} />
          </button>
        </div>
      </header>

      {/* Status strip */}
      {conversation.status === "pending" && (
        <div
          className="flex shrink-0 items-center justify-center gap-3 text-[12px] font-bold"
          style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)", padding: "8px 16px" }}
        >
          Aguardando atendimento · ninguém assumiu
          <button
            type="button"
            onClick={() => handleAssignToggle(true)}
            className="rounded-full px-3 text-[12px] font-extrabold text-white"
            style={{ background: "var(--color-accent)", minHeight: 32 }}
          >
            Assumir
          </button>
        </div>
      )}
      {conversation.status === "closed" && (
        <div
          className="flex shrink-0 items-center justify-center gap-3 text-[12px] font-bold"
          style={{ background: "var(--color-neutral-200)", color: "var(--color-neutral-800)", padding: "8px 16px" }}
        >
          Conversa encerrada
          <button type="button" onClick={() => handleClose(false)} className="font-extrabold underline">
            Reabrir
          </button>
        </div>
      )}
      {error && (
        <p className="shrink-0 px-4 py-1 text-[11px]" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto"
        style={{
          padding: "12px 12px 8px",
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--color-accent) 9%, transparent) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        {messages.length === 0 && (
          <p className="text-center text-[13px]" style={{ color: "var(--color-ink-faint)" }}>
            Nenhuma mensagem ainda.
          </p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} isPending={isPending} onRetry={(body) => handleSend(body, true)} />
        ))}
      </div>

      {/* Input */}
      <div
        className="relative shrink-0"
        style={{
          background: "#fff",
          borderTop: "1px solid var(--color-paper-line-strong)",
          padding: "8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
        }}
      >
        {sendError && (
          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--color-error)" }}>
            {sendError}{" "}
            <button type="button" className="underline" onClick={() => handleSend(undefined, true)}>
              Tentar novamente
            </button>
          </p>
        )}

        {showQuickResponses && (
          <div
            className="absolute bottom-full left-2 right-2 mb-2 max-h-64 overflow-y-auto rounded-[14px] bg-white"
            style={{ boxShadow: "0 4px 16px color-mix(in srgb, var(--color-text) 16%, transparent)" }}
          >
            {filteredQuickResponses.length === 0 ? (
              <p className="p-3 text-[13px]" style={{ color: "var(--color-ink-faint)" }}>
                Nenhuma resposta rápida encontrada.
              </p>
            ) : (
              filteredQuickResponses.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 border-b px-3 text-left"
                  style={{ minHeight: 48, borderColor: "var(--color-paper-line)", padding: "8px 12px" }}
                  onClick={() => {
                    setDraft(applyPlaceholders(r.contentText));
                    inputRef.current?.focus();
                  }}
                >
                  <span className="text-[12px] font-extrabold" style={{ color: "var(--color-accent)" }}>
                    {r.shortcut}
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
                    {r.title}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            className="input flex-1"
            style={{ borderRadius: 9999, height: 44 }}
            placeholder="Mensagem ou / para respostas rápidas"
            value={draft}
            disabled={isPending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") setDraft("");
            }}
            aria-label="Campo de mensagem"
          />
          <button
            type="button"
            className="btn btn-primary btn-icon shrink-0"
            style={{ width: 48, height: 48, opacity: draft.trim() ? 1 : 0.55 }}
            disabled={isPending || !draft.trim()}
            onClick={() => handleSend()}
            aria-label="Enviar mensagem"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <MobileChatMenu
          conversation={conversation}
          isMine={isMine}
          assigneeName={assigneeName}
          onClose={() => setMenuOpen(false)}
          onAssignToggle={handleAssignToggle}
          onBotToggle={handleBotToggle}
          onViewContact={() => {
            setMenuOpen(false);
            setSheetOpen(true);
          }}
          onCloseConversation={() => {
            setMenuOpen(false);
            setCloseDialogOpen(true);
          }}
          onReopenConversation={() => {
            setMenuOpen(false);
            handleClose(false);
          }}
        />
      )}

      {sheetOpen && <ContactSheet conversation={conversation} onClose={() => setSheetOpen(false)} onPatch={onPatch} />}

      {closeDialogOpen && (
        <CloseDialog
          onCancel={() => setCloseDialogOpen(false)}
          onConfirm={async (outcome, note) => {
            await handleClose(true, outcome, note);
            setCloseDialogOpen(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .filter((char) => char && /\p{L}/u.test(char))
    .map((char) => char.toUpperCase())
    .join("");
  return initials || "?";
}
