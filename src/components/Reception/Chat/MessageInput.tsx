"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, AlertCircle, RefreshCw, Lock } from "lucide-react";
import { useDraftMessage } from "@/src/hooks/useDraftMessage";
import { QuickResponsesPopover } from "@/app/recepcao/atendimento/quick-responses-popover";
import { TemplateSendPicker } from "@/app/recepcao/atendimento/template-send-picker";

interface MessageInputProps {
  conversationId: string;
  isPending: boolean;
  onSend: (text: string, isRetry?: boolean) => Promise<{ success: boolean; error?: string; warning?: string }>;
  contactName?: string | null;
  guardianName?: string | null;
  /** Janela de serviço de 24h do WhatsApp fechada — mensagem livre é
   * rejeitada pela Twilio (erro 63016/63024); só um modelo aprovado reabre
   * a conversa. Ver isWhatsappWindowClosed em atendimento-shell.tsx. */
  windowClosed?: boolean;
}

export function MessageInput({
  conversationId,
  isPending,
  onSend,
  contactName,
  guardianName,
  windowClosed = false,
}: MessageInputProps) {
  const { draft, setDraft, clearDraft } = useDraftMessage(conversationId, "chat");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Aplica substituidores em respostas rápidas como {nome}
  const applyPlaceholders = (text: string): string => {
    const source = guardianName ?? contactName;
    const firstName = source?.trim().split(/\s+/)[0];
    const token = /\{\{?\s*nome\s*\}?\}/gi;
    if (firstName) return text.replace(token, firstName);
    return text.replace(/,?\s*\{\{?\s*nome\s*\}?\}/gi, "");
  };

  const handleSend = async (overrideText?: string, isRetry = false) => {
    const textToSend = (overrideText ?? draft).trim();
    if (!textToSend || isPending) return;

    setErrorMessage(null);
    setWarningMessage(null);

    const result = await onSend(textToSend, isRetry);

    if (result.success) {
      clearDraft();
      if (result.warning) {
        setWarningMessage(result.warning);
      }
    } else {
      // Preserva o rascunho em caso de falha de envio!
      setErrorMessage(result.error || "Falha no envio da mensagem.");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showQuickResponses) {
      // Deixa o QuickResponsesPopover lidar com navegação se necessário, ou Enter para fechar
      if (e.key === "Escape") {
        setShowQuickResponses(false);
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    setShowQuickResponses(draft.startsWith("/"));
  }, [draft]);

  return (
    <div className="relative border-t border-paper-line-strong p-3 bg-white dark:bg-slate-900">
      {/* Alerta de Aviso de Envio */}
      {warningMessage && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>ℹ️ {warningMessage}</span>
          <button
            type="button"
            onClick={() => setWarningMessage(null)}
            className="ml-2 font-bold text-amber-700 hover:underline dark:text-amber-300"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alerta de Falha de Envio com Opção de Reenvio Impróprio/Imediato (Preservação de Dados) */}
      {errorMessage && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
            <span>
              Falha no envio da mensagem: <strong className="font-semibold">{errorMessage}</strong>
            </span>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSend(undefined, true)}
            className="flex items-center gap-1 font-bold text-red-700 hover:underline dark:text-red-300 focus:outline-none disabled:opacity-50"
          >
            <RefreshCw size={12} className={isPending ? "animate-spin" : ""} />
            Tentar novamente
          </button>
        </div>
      )}

      {windowClosed && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
          <Lock size={14} className="shrink-0" />
          <span>
            Essa conversa está fora da janela de 24h do WhatsApp — mensagem livre não é entregue. Envie um modelo
            aprovado abaixo, ou espere a família escrever de novo.
          </span>
        </div>
      )}

      {windowClosed ? (
        <TemplateSendPicker conversationId={conversationId} guardianName={guardianName} contactName={contactName} />
      ) : (
        <>
      {/* Popover de Respostas Rápidas com filtro do rascunho */}
      {showQuickResponses && (
        <QuickResponsesPopover
          filter={draft}
          onSelect={(contentText) => {
            const formatted = applyPlaceholders(contentText);
            setDraft(formatted);
            setShowQuickResponses(false);
            inputRef.current?.focus();
          }}
          onClose={() => setShowQuickResponses(false)}
        />
      )}

      {/* Input de Mensagem */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          className="input flex-1 focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm"
          placeholder="Digite uma mensagem ou / para respostas rápidas"
          value={draft}
          disabled={isPending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Campo de mensagem do atendimento"
        />
        <button
          type="button"
          className="btn btn-primary btn-icon shrink-0 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50"
          disabled={isPending || !draft.trim()}
          onClick={() => handleSend()}
          aria-label="Enviar mensagem"
          title="Enviar mensagem (Enter)"
        >
          <Send size={16} />
        </button>
      </div>
        </>
      )}
    </div>
  );
}
