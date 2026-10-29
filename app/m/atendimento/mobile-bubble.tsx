"use client";

import { memo } from "react";
import { AlertCircle, Check, CheckCheck, Clock, Paperclip, RefreshCw } from "lucide-react";
import { formatClock } from "@/lib/atendimento/chat-format";

export type MobileMessage = {
  id: string;
  senderType: string;
  direction: string;
  body: string | null;
  sentAt: string | null;
  /** "pending" = envio otimista ainda não confirmado pelo servidor. */
  deliveryStatus: string | null;
  mediaUrl: string | null;
  /** 'portal' = nota interna do portal da família, não é mensagem de WhatsApp. */
  channel: string | null;
};

// Paleta do chat, no padrão do WhatsApp (balão enviado verde-claro, recebido
// branco). Fica local porque são cores de conteúdo, não do tema do sistema.
const OUT_BG = "#d9fdd3";
const IN_BG = "#ffffff";
const INK = "#111b21";
const META = "#667781";
const READ_BLUE = "#53bdeb";
const FAIL_RED = "#b3261e";

function renderFormattedBody(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
        style={{ color: "#027eb5" }}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Ticks({ status }: { status: string | null }) {
  if (status === "pending") return <Clock size={12} aria-label="Enviando" style={{ color: META }} />;
  if (status === "read") return <CheckCheck size={15} aria-label="Lida" style={{ color: READ_BLUE }} />;
  if (status === "delivered") return <CheckCheck size={15} aria-label="Entregue" style={{ color: META }} />;
  if (status === "queued" || status === "accepted" || status === "sending") {
    return <Clock size={12} aria-label="Na fila de envio" style={{ color: META }} />;
  }
  return <Check size={15} aria-label="Enviada" style={{ color: META }} />;
}

export const MobileBubble = memo(function MobileBubble({
  message,
  groupStart,
  isRetrying,
  onRetry,
}: {
  message: MobileMessage;
  groupStart: boolean;
  isRetrying: boolean;
  onRetry: (body: string) => void;
}) {
  const isOutbound = message.direction === "outbound";
  const isFailed = message.deliveryStatus === "failed";
  const isBot = message.senderType === "bot";
  const isPortal = message.channel === "portal";
  const hasBody = Boolean(message.body && message.body.trim());
  const time = formatClock(message.sentAt);

  // A "cauda" do WhatsApp aparece só na primeira bolha da sequência: o canto
  // superior do lado de quem falou fica reto.
  const radius = isOutbound
    ? groupStart
      ? "10px 0 10px 10px"
      : "10px"
    : groupStart
      ? "0 10px 10px 10px"
      : "10px";

  return (
    <div
      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
      style={{ marginTop: groupStart ? 8 : 2 }}
    >
      <div
        className="relative max-w-[85%]"
        style={{
          background: isOutbound ? OUT_BG : IN_BG,
          color: INK,
          borderRadius: radius,
          padding: "6px 8px 4px 9px",
          boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)",
        }}
      >
        {isOutbound && isBot && (
          <div className="text-[11px] font-extrabold" style={{ color: "var(--color-accent-2-600)" }}>
            Bot
          </div>
        )}
        {isPortal && (
          <div className="text-[11px] font-bold italic" style={{ color: META }}>
            via portal da família
          </div>
        )}

        {message.mediaUrl && (
          <a
            href={`/api/arquivos/mensagem/${message.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-semibold"
            style={{ background: "rgba(11, 20, 26, 0.06)", color: INK, minHeight: 44 }}
          >
            <Paperclip size={16} aria-hidden />
            {isOutbound ? "Anexo enviado" : "Abrir anexo recebido"}
          </a>
        )}

        {hasBody && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.35]">
            {renderFormattedBody(message.body as string)}
            {/* Espaço reservado para a hora não cobrir a última linha do texto. */}
            <span aria-hidden className="inline-block" style={{ width: isOutbound ? 64 : 42 }} />
          </p>
        )}

        <div
          className="flex items-center justify-end gap-1 text-[11px] leading-none"
          style={{
            color: META,
            marginTop: hasBody ? -13 : 2,
            position: "relative",
          }}
        >
          {time && <span>{time}</span>}
          {isOutbound && !isFailed && <Ticks status={message.deliveryStatus} />}
        </div>

        {isOutbound && isFailed && (
          <button
            type="button"
            disabled={isRetrying || !message.body}
            onClick={() => message.body && onRetry(message.body)}
            className="mt-1 flex w-full items-center justify-end gap-1 text-[12px] font-bold"
            style={{ color: FAIL_RED, minHeight: 32 }}
          >
            <AlertCircle size={13} aria-hidden />
            <RefreshCw size={12} className={isRetrying ? "animate-spin" : ""} aria-hidden />
            Falhou no envio · Reenviar
          </button>
        )}
      </div>
    </div>
  );
});

export function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center" style={{ marginTop: 12, marginBottom: 4 }}>
      <span
        className="rounded-lg px-3 py-1 text-[12px] font-semibold"
        style={{ background: "#ffffff", color: META, boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)" }}
      >
        {label}
      </span>
    </div>
  );
}
