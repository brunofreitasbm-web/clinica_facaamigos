"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, UserCheck, UserMinus } from "lucide-react";

export interface ChatActionsProps {
  conversationId: string;
  status: string;
  isBotActive: boolean;
  assignedTo: string | null;
  currentUserId: string | null;
  assigneeName: string | null;
  isPending: boolean;
  onAssignToggle: (shouldAssign: boolean) => Promise<void>;
  onCloseToggle: (shouldClose: boolean) => Promise<void>;
  onBotToggle: (shouldEnableBot: boolean) => Promise<void>;
}

export function ChatActions({
  status,
  isBotActive,
  assignedTo,
  currentUserId,
  assigneeName,
  isPending,
  onAssignToggle,
  onCloseToggle,
  onBotToggle,
}: ChatActionsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isTogglingBot, setIsTogglingBot] = useState(false);

  const isClosed = status === "closed";
  const isMine = Boolean(currentUserId) && assignedTo === currentUserId;
  const isBusy = isPending || isAssigning || isTerminating || isTogglingBot;

  const handleAssignClick = async () => {
    if (isBusy) return;
    setIsAssigning(true);
    try {
      await onAssignToggle(!isMine);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleConfirmClose = async () => {
    if (isBusy) return;
    setIsTerminating(true);
    try {
      await onCloseToggle(true);
      setShowConfirmModal(false);
    } finally {
      setIsTerminating(false);
    }
  };

  const handleReopenClick = async () => {
    if (isBusy) return;
    setIsTerminating(true);
    try {
      await onCloseToggle(false);
    } finally {
      setIsTerminating(false);
    }
  };

  const handleBotClick = async () => {
    if (isBusy) return;
    setIsTogglingBot(true);
    try {
      await onBotToggle(!isBotActive);
    } finally {
      setIsTogglingBot(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "pending" && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
          >
            Aguardando atendimento
          </span>
        )}

        {/* Assumir / Liberar Button */}
        {!isClosed && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleAssignClick}
            className={`btn ${
              isMine ? "btn-ghost" : "btn-secondary"
            } flex items-center gap-1.5 text-xs focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50 disabled:cursor-not-allowed`}
            title={
              isMine
                ? "Liberar conversa (Alt + A)"
                : assigneeName
                ? `Hoje com ${assigneeName} — assumir transfere para você (Alt + A)`
                : "Assumir conversa (Alt + A)"
            }
          >
            {isAssigning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isMine ? (
              <UserMinus size={14} />
            ) : (
              <UserCheck size={14} />
            )}
            <span>{isMine ? "Liberar" : "Assumir"}</span>
            <kbd className="hidden sm:inline-block rounded bg-slate-200/80 px-1 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              Alt+A
            </kbd>
          </button>
        )}

        {/* Encerrar / Reabrir Button */}
        {isClosed ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleReopenClick}
            className="btn btn-ghost flex items-center gap-1.5 text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50"
            title="Reabrir a conversa"
          >
            {isTerminating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            <span>Reabrir</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100/70 hover:border-red-300 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Encerrar: mova para encerradas com confirmação"
          >
            {isTerminating ? <Loader2 size={14} className="animate-spin text-red-600" /> : <CheckCircle2 size={14} className="text-red-600" />}
            <span>Encerrar</span>
          </button>
        )}

        {/* Bot Switch Toggle */}
        <button
          type="button"
          disabled={isBusy}
          onClick={handleBotClick}
          className="flex shrink-0 items-center gap-2 rounded-full border border-paper-line-strong px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          style={{
            background: isBotActive
              ? "var(--color-status-active-soft, #eaf6ff)"
              : "var(--color-accent-2-100)",
            color: isBotActive
              ? "var(--color-status-active-text, #0b6ea8)"
              : "var(--color-accent-2-700)",
          }}
        >
          {isTogglingBot ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <span
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: isBotActive ? "var(--color-accent)" : "var(--color-neutral-300)" }}
            >
              <span
                className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                style={{ transform: isBotActive ? "translateX(14px)" : "translateX(2px)" }}
              />
            </span>
          )}
          {isBotActive ? "Bot ativo" : "Humano no controle"}
        </button>
      </div>

      {/* Modal de Confirmação para Encerrar (AlertDialog WCAG) */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-encerrar"
          aria-describedby="modal-desc-encerrar"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 id="modal-title-encerrar" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Encerrar atendimento deste contato?
                </h3>
                <p id="modal-desc-encerrar" className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  A conversa será movida para <strong className="font-semibold text-slate-800 dark:text-slate-200">&apos;Encerradas&apos;</strong> e o bot será pausado para novas interações manuais.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isTerminating}
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-400 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isTerminating}
                onClick={handleConfirmClose}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50"
              >
                {isTerminating && <Loader2 size={14} className="animate-spin" />}
                <span>Confirmar Encerramento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
