"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, AlertCircle, RefreshCw, Lock, Clock, Zap } from "lucide-react";
import { useDraftMessage } from "@/src/hooks/useDraftMessage";
import {
  QUICK_RESPONSES_LISTBOX_ID,
  QuickResponsesPopover,
  quickResponseOptionId,
  useQuickResponses,
  type QuickResponseRow,
} from "@/app/recepcao/atendimento/quick-responses-popover";
import { TemplateSendPicker } from "@/app/recepcao/atendimento/template-send-picker";
import {
  decideEnterKey,
  filterQuickResponses,
  isShortcutDraft,
  moveActiveIndex,
} from "@/lib/atendimento/quick-responses-pure";
import { windowClosingLabel } from "@/lib/whatsapp-window-pure";

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
  /** Última mensagem recebida do contato: base do aviso "a janela fecha em X" (últimas 2 h). */
  lastInboundAt?: string | null;
}

export function MessageInput({
  conversationId,
  isPending,
  onSend,
  contactName,
  guardianName,
  windowClosed = false,
  lastInboundAt = null,
}: MessageInputProps) {
  const { draft, setDraft, clearDraft } = useDraftMessage(conversationId, "chat");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Texto mais recente do campo, lido após o await do envio.
  const draftRef = useRef(draft);

  const quick = useQuickResponses();
  const [activeIndex, setActiveIndex] = useState(0);
  // Escape fecha a lista sem apagar o que foi digitado; vale só para esse texto.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const matches = filterQuickResponses(quick.responses, draft);
  const safeActiveIndex = matches.length === 0 ? 0 : Math.min(activeIndex, matches.length - 1);
  const popoverOpen = !windowClosed && isShortcutDraft(draft) && dismissedFor !== draft;

  // Aviso "a janela fecha em X": só nas últimas 2 h, para não virar ruído o resto do tempo.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const closingLabel = !windowClosed && now !== null ? windowClosingLabel(lastInboundAt, now) : null;

  // Aplica substituidores em respostas rápidas como {nome}
  const applyPlaceholders = (text: string): string => {
    const source = guardianName ?? contactName;
    const firstName = source?.trim().split(/\s+/)[0];
    const token = /\{\{?\s*nome\s*\}?\}/gi;
    if (firstName) return text.replace(token, firstName);
    return text.replace(/,?\s*\{\{?\s*nome\s*\}?\}/gi, "");
  };

  const selectQuickResponse = (item: QuickResponseRow) => {
    setDraft(applyPlaceholders(item.contentText));
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const handleSend = async (overrideText?: string, isRetry = false) => {
    const textToSend = (overrideText ?? draft).trim();
    if (!textToSend || isPending) return;

    setErrorMessage(null);
    setWarningMessage(null);

    // O campo é liberado já no envio (Doherty): a recepção pode começar a
    // próxima resposta sem esperar a Twilio. Por isso o rascunho só é
    // limpo se ainda for o texto enviado — nunca apaga o que veio depois.
    const result = await onSend(textToSend, isRetry);

    if (result.success) {
      if (draftRef.current.trim() === textToSend) clearDraft();
      if (result.warning) {
        setWarningMessage(result.warning);
      }
    } else {
      // Preserva o rascunho em caso de falha de envio!
      setErrorMessage(result.error || "Falha no envio da mensagem.");
    }
  };

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (popoverOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(moveActiveIndex(safeActiveIndex, e.key === "ArrowDown" ? 1 : -1, matches.length));
        return;
      }
      if (e.key === "Escape") {
        setDismissedFor(draft);
        return;
      }
      if (e.key === "Tab" && matches.length > 0) {
        e.preventDefault();
        selectQuickResponse(matches[safeActiveIndex]);
        return;
      }
    }

    if (e.key !== "Enter") return;
    // Enter escolhe o item da lista de atalhos (ou não faz nada se "/abc" não existe): antes enviava "/abc"
    // ao paciente. Shift+Enter quebra linha; composição de IME não envia.
    const decision = decideEnterKey({
      draft,
      matches: matches.length,
      shiftKey: e.shiftKey,
      composing: e.nativeEvent.isComposing,
    });
    if (decision === "newline") return;
    e.preventDefault();
    if (decision === "select") selectQuickResponse(matches[safeActiveIndex]);
    else if (decision === "send") void handleSend();
  };

  useEffect(() => {
    draftRef.current = draft;
    resizeInput();
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

      {closingLabel && (
        <div
          role="status"
          className="mb-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <Clock size={13} className="shrink-0" />
          <span>
            A janela de 24h fecha em <strong className="font-semibold">{closingLabel}</strong>. Depois disso só modelo
            aprovado é entregue.
          </span>
        </div>
      )}

      {windowClosed ? (
        <TemplateSendPicker conversationId={conversationId} guardianName={guardianName} contactName={contactName} />
      ) : (
        <>
          {/* Respostas rápidas: setas navegam; Enter ou Tab escolhem; Esc fecha */}
          {popoverOpen && (
            <QuickResponsesPopover
              items={matches}
              activeIndex={safeActiveIndex}
              status={quick.status}
              onSelect={selectQuickResponse}
              onHover={setActiveIndex}
              onRetry={quick.reload}
            />
          )}

          {/* Input de Mensagem */}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              className="input max-h-32 flex-1 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="Digite uma mensagem (Shift+Enter quebra linha)"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              aria-label="Campo de mensagem do atendimento"
              role="combobox"
              aria-expanded={popoverOpen && matches.length > 0}
              aria-controls={popoverOpen && matches.length > 0 ? QUICK_RESPONSES_LISTBOX_ID : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                popoverOpen && matches[safeActiveIndex] ? quickResponseOptionId(matches[safeActiveIndex].id) : undefined
              }
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon shrink-0 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50"
              disabled={Boolean(draft.trim())}
              onClick={() => {
                setDraft("/");
                inputRef.current?.focus();
              }}
              aria-label="Respostas rápidas"
              title="Respostas rápidas (ou digite /)"
            >
              <Zap size={16} />
            </button>
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
