"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { assignConversation, setConversationClosed, toggleBotActive } from "./actions";
import type { ConversationPatch, ConversationRow } from "./atendimento-shell";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import { ChatActions } from "@/src/components/Reception/Chat/ChatActions";
import type { AttendanceManualOutcome } from "@/lib/conversation-attendance";

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

  const isMine = Boolean(currentUserId) && conversation.assignedTo === currentUserId;
  const assigneeName = conversation.assignedTo ? (staffNames[conversation.assignedTo] ?? "outra pessoa") : null;

  const handleAssignToggle = async (shouldAssign: boolean) => {
    setError(null);
    const patch = { assignedTo: shouldAssign ? currentUserId : null, isBotActive: shouldAssign ? false : conversation.isBotActive };
    const revert = { assignedTo: conversation.assignedTo, isBotActive: conversation.isBotActive };
    onPatch(patch);

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await assignConversation(conversation.id, shouldAssign);
        if (!result.success) {
          onPatch(revert);
          setError(result.error ?? "Não foi possível atualizar a conversa.");
        }
        resolve();
      });
    });
  };

  const handleCloseToggle = async (shouldClose: boolean, outcome?: AttendanceManualOutcome, note?: string) => {
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

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await setConversationClosed(conversation.id, shouldClose, outcome, note);
        if (!result.success) {
          onPatch(revert);
          setError(result.error ?? "Não foi possível atualizar a conversa.");
        }
        resolve();
      });
    });
  };

  const handleBotToggle = async (shouldEnableBot: boolean) => {
    setError(null);
    const patch = { isBotActive: shouldEnableBot };
    const revert = { isBotActive: conversation.isBotActive };
    onPatch(patch);

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await toggleBotActive(conversation.id, shouldEnableBot);
        if (!result.success) {
          onPatch(revert);
          setError(result.error ?? "Não foi possível atualizar o bot.");
        }
        resolve();
      });
    });
  };

  return (
    <div className="border-b border-paper-line-strong px-5 py-3 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {conversation.patientId ? (
              <Link
                href={`/recepcao/pacientes/${conversation.patientId}`}
                className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline"
              >
                {conversation.displayName}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {conversation.displayName}
              </span>
            )}
            {conversation.planName && (
              <HealthPlanBadge name={conversation.planName} color={conversation.planColor} size="md" className="shrink-0" />
            )}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {conversation.guardianName ?? conversation.phoneNumber}
            {assigneeName && ` · com ${isMine ? "você" : assigneeName}`}
          </p>
        </div>

        <ChatActions
          conversationId={conversation.id}
          status={conversation.status}
          isBotActive={conversation.isBotActive}
          assignedTo={conversation.assignedTo}
          currentUserId={currentUserId}
          assigneeName={assigneeName}
          isPending={isPending}
          onAssignToggle={handleAssignToggle}
          onCloseToggle={handleCloseToggle}
          onBotToggle={handleBotToggle}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}
    </div>
  );
}
