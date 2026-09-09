"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleBotActive } from "./actions";
import type { ConversationRow } from "./atendimento-shell";

export function ChatHeader({ conversation }: { conversation: ConversationRow }) {
  const [isBotActive, setIsBotActive] = useState(conversation.isBotActive);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4 border-b border-paper-line-strong px-5 py-3">
      <div className="min-w-0">
        {conversation.patientId ? (
          <Link
            href={`/recepcao/pacientes/${conversation.patientId}`}
            className="truncate text-sm font-semibold text-ink hover:underline"
          >
            {conversation.displayName}
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold text-ink">{conversation.displayName}</span>
        )}
        <p className="truncate text-xs text-ink-faint">
          {conversation.guardianName ?? conversation.phoneNumber}
        </p>
      </div>

      {conversation.status === "pending" && (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
        >
          Aguardando atendimento
        </span>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const next = !isBotActive;
          setIsBotActive(next);
          startTransition(async () => {
            const result = await toggleBotActive(conversation.id, next);
            if (!result.success) setIsBotActive(!next);
          });
        }}
        className="flex shrink-0 items-center gap-2 rounded-full border border-paper-line-strong px-3 py-1.5 text-xs font-semibold transition-colors"
        style={{
          background: isBotActive ? "var(--color-status-active-soft, #eaf6ff)" : "var(--color-accent-2-100)",
          color: isBotActive ? "var(--color-status-active-text, #0b6ea8)" : "var(--color-accent-2-700)",
        }}
      >
        <span
          className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
          style={{ background: isBotActive ? "var(--color-accent)" : "var(--color-neutral-300)" }}
        >
          <span
            className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
            style={{ transform: isBotActive ? "translateX(14px)" : "translateX(2px)" }}
          />
        </span>
        {isBotActive ? "Bot ativo" : "Humano no controle"}
      </button>
    </div>
  );
}
