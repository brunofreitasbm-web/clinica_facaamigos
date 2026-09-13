"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, RotateCcw, UserCheck, UserMinus } from "lucide-react";
import { assignConversation, setConversationClosed, toggleBotActive } from "./actions";
import type { ConversationPatch, ConversationRow } from "./atendimento-shell";

export function ChatHeader({
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isClosed = conversation.status === "closed";
  const isMine = Boolean(currentUserId) && conversation.assignedTo === currentUserId;
  const assigneeName = conversation.assignedTo ? (staffNames[conversation.assignedTo] ?? "outra pessoa") : null;

  // Otimista: aplica o patch no estado do pai (fonte de verdade que também
  // recebe as atualizações do Realtime) e desfaz se o servidor recusar.
  const run = (action: () => Promise<{ success: boolean; error?: string }>, patch: ConversationPatch, revert: ConversationPatch) => {
    setError(null);
    onPatch(patch);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        onPatch(revert);
        setError(result.error ?? "Não foi possível atualizar a conversa.");
      }
    });
  };

  return (
    <div className="border-b border-paper-line-strong px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            {assigneeName && ` · com ${isMine ? "você" : assigneeName}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {conversation.status === "pending" && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
            >
              Aguardando atendimento
            </span>
          )}

          {!isClosed &&
            (isMine ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => assignConversation(conversation.id, false),
                    { assignedTo: null },
                    { assignedTo: conversation.assignedTo },
                  )
                }
                className="btn btn-ghost flex items-center gap-1.5 text-xs"
                title="Liberar a conversa para outra pessoa da equipe"
              >
                <UserMinus size={14} /> Liberar
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => assignConversation(conversation.id, true),
                    { assignedTo: currentUserId, isBotActive: false },
                    { assignedTo: conversation.assignedTo, isBotActive: conversation.isBotActive },
                  )
                }
                className="btn btn-secondary flex items-center gap-1.5 text-xs"
                title={
                  assigneeName
                    ? `Hoje com ${assigneeName} — assumir transfere para você`
                    : "Assumir: desliga o bot e marca a conversa como sua"
                }
              >
                <UserCheck size={14} /> Assumir
              </button>
            ))}

          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              isClosed
                ? run(() => setConversationClosed(conversation.id, false), { status: "open" }, { status: "closed" })
                : run(
                    () => setConversationClosed(conversation.id, true),
                    { status: "closed", unreadCount: 0, assignedTo: null, isBotActive: true, escalationReason: null },
                    {
                      status: conversation.status,
                      unreadCount: conversation.unreadCount,
                      assignedTo: conversation.assignedTo,
                      isBotActive: conversation.isBotActive,
                      escalationReason: conversation.escalationReason,
                    },
                  )
            }
            className="btn btn-ghost flex items-center gap-1.5 text-xs"
            title={isClosed ? "Reabrir a conversa" : "Encerrar: devolve ao bot e tira da fila de abertas"}
          >
            {isClosed ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
            {isClosed ? "Reabrir" : "Encerrar"}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => toggleBotActive(conversation.id, !conversation.isBotActive),
                { isBotActive: !conversation.isBotActive },
                { isBotActive: conversation.isBotActive },
              )
            }
            className="flex shrink-0 items-center gap-2 rounded-full border border-paper-line-strong px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: conversation.isBotActive
                ? "var(--color-status-active-soft, #eaf6ff)"
                : "var(--color-accent-2-100)",
              color: conversation.isBotActive
                ? "var(--color-status-active-text, #0b6ea8)"
                : "var(--color-accent-2-700)",
            }}
          >
            <span
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: conversation.isBotActive ? "var(--color-accent)" : "var(--color-neutral-300)" }}
            >
              <span
                className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                style={{ transform: conversation.isBotActive ? "translateX(14px)" : "translateX(2px)" }}
              />
            </span>
            {conversation.isBotActive ? "Bot ativo" : "Humano no controle"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}
    </div>
  );
}
