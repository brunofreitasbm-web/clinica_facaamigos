"use client";

import { Bot, CheckCircle2, RotateCcw, User, UserCheck, UserMinus } from "lucide-react";
import type { ConversationRow } from "@/lib/atendimento/types";

export function MobileChatMenu({
  conversation,
  isMine,
  assigneeName,
  onClose,
  onAssignToggle,
  onBotToggle,
  onViewContact,
  onCloseConversation,
  onReopenConversation,
}: {
  conversation: ConversationRow;
  isMine: boolean;
  assigneeName: string | null;
  onClose: () => void;
  onAssignToggle: (shouldAssign: boolean) => void;
  onBotToggle: (shouldEnableBot: boolean) => void;
  onViewContact: () => void;
  onCloseConversation: () => void;
  onReopenConversation: () => void;
}) {
  const isClosed = conversation.status === "closed";

  const assignLabel = isMine ? "Liberar conversa" : assigneeName ? `Assumir (hoje com ${assigneeName})` : "Assumir conversa";

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "color-mix(in srgb, var(--color-neutral-900) 18%, transparent)" }}
      onClick={onClose}
    >
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        className="absolute flex flex-col gap-0.5 rounded-[18px] bg-white p-1.5"
        style={{
          width: 272,
          top: "calc(env(safe-area-inset-top, 0px) + 64px)",
          right: 10,
          boxShadow: "0 12px 32px color-mix(in srgb, var(--color-text) 22%, transparent)",
        }}
      >
        {!isClosed && (
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-bold"
            style={{ minHeight: 48, color: "var(--color-text)" }}
            onClick={() => {
              onAssignToggle(!isMine);
              onClose();
            }}
          >
            {isMine ? <UserMinus size={18} color="var(--color-accent)" /> : <UserCheck size={18} color="var(--color-accent)" />}
            {assignLabel}
          </button>
        )}

        <button
          type="button"
          role="menuitem"
          className="flex items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-bold"
          style={{ minHeight: 48, color: "var(--color-text)" }}
          onClick={() => onBotToggle(!conversation.isBotActive)}
        >
          {conversation.isBotActive ? <Bot size={18} color="var(--color-accent)" /> : <User size={18} color="var(--color-accent)" />}
          <span className="flex-1">{conversation.isBotActive ? "Bot ativo" : "Humano no controle"}</span>
          <span
            className="relative inline-flex shrink-0 items-center rounded-full transition-colors"
            style={{ width: 34, height: 20, background: conversation.isBotActive ? "var(--color-accent)" : "var(--color-neutral-300)" }}
          >
            <span
              className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
              style={{ transform: conversation.isBotActive ? "translateX(16px)" : "translateX(2px)" }}
            />
          </span>
        </button>

        <button
          type="button"
          role="menuitem"
          className="flex items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-bold"
          style={{ minHeight: 48, color: "var(--color-text)" }}
          onClick={onViewContact}
        >
          <User size={18} color="var(--color-accent)" />
          Ver contato
        </button>

        <div style={{ height: 1, margin: "4px 8px", background: "var(--color-paper-line)" }} />

        {isClosed ? (
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-bold"
            style={{ minHeight: 48, color: "var(--color-accent)" }}
            onClick={onReopenConversation}
          >
            <RotateCcw size={18} color="var(--color-accent)" />
            Reabrir conversa
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-bold"
            style={{ minHeight: 48, color: "var(--color-error)" }}
            onClick={onCloseConversation}
          >
            <CheckCircle2 size={18} color="var(--color-error)" />
            Encerrar atendimento
          </button>
        )}
      </div>
    </div>
  );
}
