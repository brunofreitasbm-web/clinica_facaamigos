"use client";

import { useTransition } from "react";
import { Bot, User } from "lucide-react";
import { markConversationRead } from "./actions";
import type { ConversationRow } from "./atendimento-shell";

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {conversations.map((c) => {
        const isSelected = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              onSelect(c.id);
              startTransition(() => {
                markConversationRead(c.id);
              });
            }}
            className="flex w-full items-center gap-3 border-b border-paper-line px-4 py-3 text-left transition-colors"
            style={{
              background: isSelected ? "var(--color-accent-2-100)" : "transparent",
            }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                background: "var(--color-accent-2-100)",
                color: "var(--color-accent-2-700)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {initialsOf(c.patientName)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-ink">{c.patientName}</span>
                {c.isBotActive ? (
                  <Bot size={13} className="shrink-0 text-ink-faint" />
                ) : (
                  <User size={13} className="shrink-0 text-status-active" />
                )}
              </span>
              <span className="block truncate text-xs text-ink-faint">
                {c.guardianName ?? c.phoneNumber}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] text-ink-faint">{relativeTime(c.lastMessageAt)}</span>
              {c.unreadCount > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  {c.unreadCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {conversations.length === 0 && (
        <p className="p-4 text-sm text-ink-faint">Nenhuma conversa ainda.</p>
      )}
    </div>
  );
}
