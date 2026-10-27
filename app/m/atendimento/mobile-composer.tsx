"use client";

import { useEffect, useRef } from "react";
import { Lock, Send, Zap } from "lucide-react";
import { TemplateSendPicker } from "@/app/recepcao/atendimento/template-send-picker";

export type QuickResponseRow = { id: string; shortcut: string; title: string; contentText: string };

const MAX_COMPOSER_HEIGHT = 140;

/**
 * Barra de envio no estilo do WhatsApp: campo arredondado que cresce com o
 * texto, botão de respostas rápidas e botão redondo de enviar. No celular o
 * Enter quebra linha (como no WhatsApp); envia-se pelo botão. Ctrl/Cmd+Enter
 * também envia, para quem testa com teclado.
 *
 * Fora da janela de 24h do WhatsApp a mensagem livre não é entregue (erro
 * 63016): o campo dá lugar ao envio de modelo aprovado.
 */
export function MobileComposer({
  draft,
  onDraftChange,
  onSend,
  quickResponses,
  onPickQuickResponse,
  windowClosed,
  conversationId,
  guardianName,
  contactName,
  sendError,
  warning,
  onDismissWarning,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  quickResponses: QuickResponseRow[];
  onPickQuickResponse: (contentText: string) => void;
  windowClosed: boolean;
  conversationId: string;
  guardianName: string | null;
  contactName: string | null;
  sendError: string | null;
  warning: string | null;
  onDismissWarning: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [draft]);

  const showQuickResponses = !windowClosed && draft.startsWith("/");
  const normalizedFilter = draft.replace(/^\//, "").toLowerCase();
  const filteredQuickResponses = quickResponses.filter(
    (r) =>
      r.shortcut.replace(/^\//, "").toLowerCase().startsWith(normalizedFilter) ||
      r.title.toLowerCase().includes(normalizedFilter),
  );
  const canSend = draft.trim().length > 0;

  return (
    <div
      className="relative shrink-0"
      style={{
        background: "var(--color-chat-bg)",
        padding: "6px 8px calc(env(safe-area-inset-bottom, 0px) + 8px)",
      }}
    >
      {sendError && (
        <p role="alert" className="mb-1.5 px-2 text-[12px] font-semibold" style={{ color: "var(--color-error)" }}>
          {sendError}
        </p>
      )}
      {warning && (
        <p
          role="status"
          className="mb-1.5 flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-[12px]"
          style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
        >
          <span>{warning}</span>
          <button type="button" onClick={onDismissWarning} className="shrink-0 font-extrabold underline">
            Fechar
          </button>
        </p>
      )}

      {windowClosed ? (
        <div className="rounded-2xl bg-white p-3" style={{ boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)" }}>
          <p className="mb-2 flex items-start gap-2 text-[12px]" style={{ color: "var(--color-neutral-600)" }}>
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Fora da janela de 24h do WhatsApp — mensagem livre não é entregue. Envie um modelo aprovado ou espere a
              família escrever de novo.
            </span>
          </p>
          <TemplateSendPicker conversationId={conversationId} guardianName={guardianName} contactName={contactName} />
        </div>
      ) : (
        <>
          {showQuickResponses && (
            <div
              className="absolute bottom-full left-2 right-2 mb-1 max-h-64 overflow-y-auto rounded-[14px] bg-white"
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
                    className="flex w-full flex-col items-start gap-0.5 border-b text-left"
                    style={{ minHeight: 48, borderColor: "var(--color-paper-line)", padding: "8px 12px" }}
                    onClick={() => {
                      onPickQuickResponse(r.contentText);
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

          <div className="flex items-end gap-2">
            <div
              className="flex min-w-0 flex-1 items-end rounded-[22px] bg-white"
              style={{ boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)" }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    onSend();
                  }
                  if (e.key === "Escape") onDraftChange("");
                }}
                placeholder="Mensagem"
                aria-label="Campo de mensagem"
                enterKeyHint="enter"
                className="min-w-0 flex-1 resize-none border-0 bg-transparent text-[16px] leading-[1.3] outline-none"
                style={{ padding: "11px 4px 11px 16px", maxHeight: MAX_COMPOSER_HEIGHT, color: "#111b21" }}
              />
              <button
                type="button"
                aria-label="Respostas rápidas"
                onClick={() => {
                  onDraftChange(draft.startsWith("/") ? "" : "/");
                  inputRef.current?.focus();
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ color: showQuickResponses ? "var(--color-accent)" : "#667781" }}
              >
                <Zap size={20} />
              </button>
            </div>

            <button
              type="button"
              aria-label="Enviar mensagem"
              disabled={!canSend}
              onClick={onSend}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "var(--color-accent)", opacity: canSend ? 1 : 0.5 }}
            >
              <Send size={19} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
