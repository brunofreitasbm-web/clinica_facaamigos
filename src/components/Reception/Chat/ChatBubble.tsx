"use client";

import React from "react";
import { AlertTriangle, Info, Paperclip, RefreshCw } from "lucide-react";

export interface ChatMessage {
  id: string;
  senderType: string;
  direction: string;
  body: string | null;
  sentAt: string | null;
  deliveryStatus: string | null;
  /** URL crua do Twilio (`messages.media_url`) — nunca usada direto no href:
   *  exige Basic Auth. Serve só de sinalizador de que a mensagem tem anexo;
   *  quem entrega o arquivo é /api/arquivos/mensagem/[id]. */
  mediaUrl?: string | null;
}

interface ChatBubbleProps {
  message: ChatMessage;
  isPending?: boolean;
  onRetry?: (body: string) => void;
}

/**
 * Função para renderizar texto com links clicáveis com sublinhado obrigatório
 * e alto contraste (WCAG 2.1 AA).
 */
function renderFormattedBody(text: string | null, isOutbound: boolean) {
  if (!text) return null;

  // Regex para identificar URLs simples
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 font-medium focus-visible:outline-2 focus-visible:outline-white ${
            isOutbound
              ? "text-sky-100 hover:text-white"
              : "text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
          }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/**
 * Anexo recebido por WhatsApp. O arquivo já está no nosso Storage (ingestão
 * do webhook); a rota resolve a URL do Twilio para a cópia guardada e devolve
 * 302 assinado. `<a target="_blank">` comum — sem window.open pós-await, que
 * o navegador bloqueia como pop-up.
 */
function MediaAttachment({ messageId, isOutbound }: { messageId: string; isOutbound: boolean }) {
  return (
    <a
      href={`/api/arquivos/mensagem/${messageId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1 mb-1.5 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium underline underline-offset-2 transition-colors focus-visible:outline-2 ${
        isOutbound
          ? "border-white/30 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white"
          : "border-slate-300 bg-white text-teal-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-teal-300 dark:hover:bg-slate-800"
      }`}
    >
      <Paperclip size={13} className="shrink-0" aria-hidden />
      <span>Abrir anexo recebido</span>
    </a>
  );
}

export const ChatBubble = React.memo(function ChatBubble({
  message,
  isPending,
  onRetry,
}: ChatBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isFailed = message.deliveryStatus === "failed";
  const isSimulated = message.deliveryStatus === "simulated_dev";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} my-1.5`}>
      <div
        className={`max-w-[75%] sm:max-w-[70%] rounded-xl px-4 py-2.5 text-sm shadow-2xs transition-all ${
          isOutbound
            ? isFailed
              ? "bg-red-700 text-white"
              : isSimulated
              ? "bg-blue-700 text-white"
              : "bg-teal-700 text-white dark:bg-teal-800"
            : "bg-slate-100 text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
        }`}
      >
        {message.mediaUrl && <MediaAttachment messageId={message.id} isOutbound={isOutbound} />}

        {message.body && message.body.trim().length > 0 ? (
          <p className="whitespace-pre-wrap leading-relaxed break-words">
            {renderFormattedBody(message.body, isOutbound)}
          </p>
        ) : (
          // Mensagem só com anexo chegava como bolha vazia — sem nenhum
          // indício de que a família tinha mandado arquivo.
          !message.mediaUrl && <p className="whitespace-pre-wrap leading-relaxed break-words" />
        )}

        <div
          className={`mt-1.5 flex items-center justify-between gap-2 text-[11px] ${
            isOutbound ? "text-slate-100/90" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <span className="flex items-center gap-1 font-medium">
            {message.sentAt
              ? new Date(message.sentAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
            {isOutbound && message.deliveryStatus && (
              <span className="inline-flex items-center gap-1">
                ·{" "}
                {isFailed ? (
                  <span className="inline-flex items-center gap-0.5 text-amber-200 font-bold">
                    <AlertTriangle size={11} /> Falhou no envio
                  </span>
                ) : isSimulated ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Info size={11} /> Modo Local
                  </span>
                ) : (
                  message.deliveryStatus
                )}
              </span>
            )}
          </span>

          {isOutbound && isFailed && message.body && onRetry && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onRetry(message.body!)}
              className="inline-flex items-center gap-1 font-bold underline hover:text-white disabled:opacity-50"
              title="Tentar reenviar esta mensagem"
            >
              <RefreshCw size={11} className={isPending ? "animate-spin" : ""} />
              Reenviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
