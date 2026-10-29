"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDraftMessage } from "@/src/hooks/useDraftMessage";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import {
  assignConversation,
  markConversationRead,
  sendManualMessage,
  setConversationClosed,
  toggleBotActive,
} from "@/app/recepcao/atendimento/actions";
import type { AttendanceManualOutcome } from "@/lib/conversation-attendance";
import type { ConversationPatch, ConversationRow } from "@/lib/atendimento/types";
import { buildChatItems, hasEchoedMessage } from "@/lib/atendimento/chat-format";
import { isWhatsappWindowClosed } from "@/lib/atendimento/whatsapp-window";
import { MobileChatMenu } from "./mobile-chat-menu";
import { ContactSheet } from "./contact-sheet";
import { CloseDialog } from "./close-dialog";
import { DayChip, MobileBubble, type MobileMessage } from "./mobile-bubble";
import { MobileComposer, type QuickResponseRow } from "./mobile-composer";
import { useBackLayers } from "@/lib/use-back-handler";

const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_SELECT = "id, sender_type, direction, body, sent_at, delivery_status, media_url, channel";
/** Distância do fim (px) abaixo da qual a rolagem acompanha mensagens novas. */
const STICK_THRESHOLD_PX = 80;

type RawMessage = {
  id: string;
  sender_type: string;
  direction: string;
  body: string | null;
  sent_at: string | null;
  delivery_status: string | null;
  media_url: string | null;
  channel?: string | null;
};

function toMessage(m: RawMessage): MobileMessage {
  return {
    id: m.id,
    senderType: m.sender_type,
    direction: m.direction,
    body: m.body,
    sentAt: m.sent_at,
    deliveryStatus: m.delivery_status,
    mediaUrl: m.media_url,
    channel: m.channel ?? null,
  };
}

function byTime(a: MobileMessage, b: MobileMessage): number {
  return (a.sentAt ?? "").localeCompare(b.sentAt ?? "");
}

/** Mescla por id (a versão nova vence) e mantém a ordem cronológica. */
function mergeMessages(prev: MobileMessage[], incoming: MobileMessage[]): MobileMessage[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort(byTime);
}

/** Envio otimista: a bolha aparece na hora, antes de a Twilio responder. */
type PendingSend = { id: string; body: string; createdAt: number };

export function MobileChat({
  conversation,
  currentUserId,
  staffNames,
  onBack,
  onPatch,
}: {
  conversation: ConversationRow;
  currentUserId: string | null;
  staffNames: Record<string, string>;
  onBack: () => void;
  onPatch: (patch: ConversationPatch) => void;
}) {
  const [messages, setMessages] = useState<MobileMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<PendingSend[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  // Botão/gesto voltar do celular fecha a camada aberta (diálogo, ficha do contato, menu) antes de sair da conversa.
  useBackLayers([
    { active: closeDialogOpen, back: () => setCloseDialogOpen(false) },
    { active: sheetOpen, back: () => setSheetOpen(false) },
    { active: menuOpen, back: () => setMenuOpen(false) },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendWarning, setSendWarning] = useState<string | null>(null);
  // A Twilio recusou texto livre (63016/63024) mesmo com lastInboundAt recente:
  // vale o veredito do servidor até a próxima mensagem do contato.
  const [serverSaysWindowClosed, setServerSaysWindowClosed] = useState(false);
  const [quickResponses, setQuickResponses] = useState<QuickResponseRow[]>([]);
  const { draft, setDraft, clearDraft } = useDraftMessage(conversation.id, "chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  // true enquanto o operador está perto do fim: só então mensagem nova arrasta a rolagem.
  const stickToBottomRef = useRef(true);
  // Ao carregar mensagens antigas (prepend), guarda a altura anterior para não perder o ponto de leitura.
  const restoreScrollRef = useRef<number | null>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const isMine = Boolean(currentUserId) && conversation.assignedTo === currentUserId;
  const assigneeName = conversation.assignedTo ? (staffNames[conversation.assignedTo] ?? "outra pessoa") : null;
  const windowClosed = serverSaysWindowClosed || isWhatsappWindowClosed(conversation);

  // Abrir a conversa (inclusive direto pelo push em /m/atendimento/[id]) zera
  // o contador no banco — sem isto ele voltava a cada recarga.
  useEffect(() => {
    onPatch({ unreadCount: 0 });
    void markConversationRead(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const refetchLatest = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    setMessages((prev) => mergeMessages(prev, (data ?? []).map(toMessage)));
  }, [conversation.id]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []).map(toMessage).sort(byTime);
        setMessages((prev) => mergeMessages(prev, rows));
        setHasMore((data ?? []).length === MESSAGE_PAGE_SIZE);
        setLoaded(true);
      });

    const channel = supabase
      .channel(`m-atendimento-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const raw = payload.new as RawMessage | null;
          if (!raw?.id) return;
          const row = toMessage(raw);
          if (row.direction === "outbound") stickToBottomRef.current = true;
          if (payload.eventType === "INSERT" && row.direction === "inbound") {
            // Contato escreveu com a conversa aberta: já está lido, e a janela de 24h reabriu.
            setServerSaysWindowClosed(false);
            void markConversationRead(conversation.id);
          }
          setMessages((prev) => mergeMessages(prev, [row]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("quick_responses")
      .select("id, shortcut, title, content_text")
      .order("shortcut")
      .then(({ data }) => {
        if (cancelled) return;
        setQuickResponses((data ?? []).map((r) => ({ id: r.id, shortcut: r.shortcut, title: r.title, contentText: r.content_text })));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Envios otimistas cujo eco já chegou pelo realtime deixam de aparecer.
  const visiblePending = useMemo(() => pending.filter((p) => !hasEchoedMessage(messages, p)), [pending, messages]);

  const items = useMemo(() => {
    const optimistic: MobileMessage[] = visiblePending.map((p) => ({
      id: p.id,
      senderType: "agent",
      direction: "outbound",
      body: p.body,
      sentAt: new Date(p.createdAt).toISOString(),
      deliveryStatus: "pending",
      mediaUrl: null,
      channel: "whatsapp",
    }));
    return buildChatItems([...messages, ...optimistic]);
  }, [messages, visiblePending]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollTo no próprio container (não scrollIntoView, que "puxa" a página inteira no iOS Safari).
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const totalCount = messages.length + visiblePending.length;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreScrollRef.current !== null) {
      el.scrollTop = el.scrollHeight - restoreScrollRef.current;
      restoreScrollRef.current = null;
      prevCountRef.current = totalCount;
      return;
    }
    const added = totalCount - prevCountRef.current;
    const firstPaint = prevCountRef.current === 0;
    prevCountRef.current = totalCount;
    if (added <= 0) return;
    if (stickToBottomRef.current || firstPaint) {
      scrollToBottom(!firstPaint);
      setNewBelow(0);
    } else {
      setNewBelow((n) => n + added);
    }
  }, [totalCount, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) setNewBelow(0);
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]?.sentAt;
    const el = scrollRef.current;
    if (!oldest || !el || loadingMore) return;
    setLoadingMore(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversation.id)
        .lt("sent_at", oldest)
        .order("sent_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      restoreScrollRef.current = el.scrollHeight - el.scrollTop;
      setMessages((prev) => mergeMessages(prev, (data ?? []).map(toMessage)));
      setHasMore((data ?? []).length === MESSAGE_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [conversation.id, messages, loadingMore]);

  const applyPlaceholders = useCallback(
    (text: string): string => {
      const source = conversation.guardianName ?? conversation.contactName;
      const firstName = source?.trim().split(/\s+/)[0];
      const token = /\{\{?\s*nome\s*\}?\}/gi;
      return firstName ? text.replace(token, firstName) : text.replace(/,?\s*\{\{?\s*nome\s*\}?\}/gi, "");
    },
    [conversation.guardianName, conversation.contactName],
  );

  const sendBody = async (body: string, { isRetry }: { isRetry: boolean }) => {
    setSendError(null);
    setSendWarning(null);
    stickToBottomRef.current = true;
    const optimistic: PendingSend = { id: `pending-${crypto.randomUUID()}`, body, createdAt: Date.now() };
    // Doherty: o campo é liberado na hora; o texto só volta se o envio falhar.
    if (!isRetry) clearDraft();
    setPending((prev) => [...prev, optimistic]);
    if (isRetry) setRetrying(true);

    const result = await sendManualMessage(conversation.id, body);

    if (result.success) {
      if ("warning" in result && result.warning) setSendWarning(result.warning);
      // Garante a mensagem real na tela mesmo se o realtime atrasar; só então some a otimista.
      await refetchLatest();
    } else {
      setSendError(result.error || "Falha ao enviar mensagem.");
      if ("windowClosed" in result && result.windowClosed) setServerSaysWindowClosed(true);
      // Se a linha "failed" foi gravada, ela chega pelo realtime com botão Reenviar.
      // Devolve o texto ao campo só quando o operador ainda não digitou outra coisa.
      else if (!isRetry && !draftRef.current.trim()) setDraft(body);
    }
    setPending((prev) => prev.filter((p) => p.id !== optimistic.id));
    if (isRetry) setRetrying(false);
  };

  const handleSend = () => {
    const body = draft.trim();
    if (body) void sendBody(body, { isRetry: false });
  };

  const handleAssignToggle = async (shouldAssign: boolean) => {
    setError(null);
    const patch = { assignedTo: shouldAssign ? currentUserId : null, isBotActive: shouldAssign ? false : conversation.isBotActive };
    const revert = { assignedTo: conversation.assignedTo, isBotActive: conversation.isBotActive };
    onPatch(patch);
    const result = await assignConversation(conversation.id, shouldAssign);
    if (!result.success) {
      onPatch(revert);
      setError(result.error ?? "Não foi possível atualizar a conversa.");
    }
  };

  const handleBotToggle = async (shouldEnableBot: boolean) => {
    setError(null);
    const patch = { isBotActive: shouldEnableBot };
    const revert = { isBotActive: conversation.isBotActive };
    onPatch(patch);
    const result = await toggleBotActive(conversation.id, shouldEnableBot);
    if (!result.success) {
      onPatch(revert);
      setError(result.error ?? "Não foi possível atualizar o bot.");
    }
  };

  const handleClose = async (shouldClose: boolean, outcome?: AttendanceManualOutcome, note?: string) => {
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
    const result = await setConversationClosed(conversation.id, shouldClose, outcome, note);
    if (!result.success) {
      onPatch(revert);
      setError(result.error ?? "Não foi possível atualizar a conversa.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "var(--color-chat-bg)" }}>
      {/* Header */}
      <header
        className="shrink-0"
        style={{
          background: "var(--color-accent)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingRight: 8,
          paddingBottom: 8,
          paddingLeft: 4,
          boxShadow: "0 1px 4px color-mix(in srgb, var(--color-text) 20%, transparent)",
        }}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Voltar"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
              style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
            >
              {initialsOf(conversation.displayName)}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[16px] font-extrabold text-white">{conversation.displayName}</span>
                {conversation.planName && <HealthPlanBadge name={conversation.planName} color={conversation.planColor} size="md" />}
              </span>
              <span className="block truncate text-[12px]" style={{ color: "color-mix(in srgb, #fff 85%, transparent)" }}>
                {conversation.guardianName ?? conversation.phoneNumber}
                {assigneeName ? ` · com ${isMine ? "você" : assigneeName}` : ""}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Mais opções"
            onClick={() => setMenuOpen(true)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          >
            <MoreVertical size={22} />
          </button>
        </div>
      </header>

      {/* Status strip */}
      {conversation.status === "pending" && (
        <div
          className="flex shrink-0 items-center justify-center gap-3 text-[12px] font-bold"
          style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)", padding: "8px 16px" }}
        >
          Aguardando atendimento · ninguém assumiu
          <button
            type="button"
            onClick={() => handleAssignToggle(true)}
            className="rounded-full px-3 text-[12px] font-extrabold text-white"
            style={{ background: "var(--color-accent)", minHeight: 32 }}
          >
            Assumir
          </button>
        </div>
      )}
      {conversation.status === "closed" && (
        <div
          className="flex shrink-0 items-center justify-center gap-3 text-[12px] font-bold"
          style={{ background: "var(--color-neutral-200)", color: "var(--color-neutral-800)", padding: "8px 16px" }}
        >
          Conversa encerrada
          <button type="button" onClick={() => handleClose(false)} className="font-extrabold underline">
            Reabrir
          </button>
        </div>
      )}
      {error && (
        <p className="shrink-0 px-4 py-1 text-[11px]" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}

      {/* Mensagens */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
          style={{
            padding: "8px 10px 8px",
            overscrollBehavior: "contain",
            backgroundImage:
              "radial-gradient(color-mix(in srgb, var(--color-accent) 9%, transparent) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        >
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadOlder}
                className="rounded-full bg-white px-4 text-[12px] font-bold disabled:opacity-60"
                style={{ minHeight: 36, color: "var(--color-accent)", boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)" }}
              >
                {loadingMore ? "Carregando…" : "Carregar mensagens anteriores"}
              </button>
            </div>
          )}
          {!loaded && (
            <p role="status" className="text-center text-[13px]" style={{ color: "var(--color-ink-faint)" }}>
              Carregando mensagens…
            </p>
          )}
          {loaded && items.length === 0 && (
            <p className="text-center text-[13px]" style={{ color: "var(--color-ink-faint)" }}>
              Nenhuma mensagem ainda.
            </p>
          )}
          {items.map((item) =>
            item.kind === "day" ? (
              <DayChip key={item.key} label={item.label} />
            ) : (
              <MobileBubble
                key={item.key}
                message={item.message}
                groupStart={item.groupStart}
                isRetrying={retrying}
                onRetry={(body) => void sendBody(body, { isRetry: true })}
              />
            ),
          )}
        </div>

        {newBelow > 0 && (
          <button
            type="button"
            aria-label={`${newBelow} mensagens novas, ir para o fim`}
            onClick={() => {
              stickToBottomRef.current = true;
              setNewBelow(0);
              scrollToBottom(true);
            }}
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white"
            style={{ color: "var(--color-accent)", boxShadow: "0 2px 6px rgba(11, 20, 26, 0.25)" }}
          >
            <ChevronDown size={24} />
            <span
              className="absolute -top-1.5 right-0 flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {newBelow}
            </span>
          </button>
        )}
      </div>

      <MobileComposer
        key={conversation.id}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        quickResponses={quickResponses}
        onPickQuickResponse={(contentText) => setDraft(applyPlaceholders(contentText))}
        windowClosed={windowClosed}
        conversationId={conversation.id}
        guardianName={conversation.guardianName}
        contactName={conversation.contactName}
        sendError={sendError}
        warning={sendWarning}
        onDismissWarning={() => setSendWarning(null)}
      />

      {menuOpen && (
        <MobileChatMenu
          conversation={conversation}
          isMine={isMine}
          assigneeName={assigneeName}
          onClose={() => setMenuOpen(false)}
          onAssignToggle={handleAssignToggle}
          onBotToggle={handleBotToggle}
          onViewContact={() => {
            setMenuOpen(false);
            setSheetOpen(true);
          }}
          onCloseConversation={() => {
            setMenuOpen(false);
            setCloseDialogOpen(true);
          }}
          onReopenConversation={() => {
            setMenuOpen(false);
            handleClose(false);
          }}
        />
      )}

      {sheetOpen && <ContactSheet conversation={conversation} onClose={() => setSheetOpen(false)} onPatch={onPatch} />}

      {closeDialogOpen && (
        <CloseDialog
          onCancel={() => setCloseDialogOpen(false)}
          onConfirm={async (outcome, note) => {
            await handleClose(true, outcome, note);
            setCloseDialogOpen(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .filter((char) => char && /\p{L}/u.test(char))
    .map((char) => char.toUpperCase())
    .join("");
  return initials || "?";
}
