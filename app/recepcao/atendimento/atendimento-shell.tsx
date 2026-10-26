"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ConversationList, type ConversationFilter } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { PatientContextPanel } from "./patient-context-panel";
import { LeadContextPanel } from "./lead-context-panel";
import { formatConversationPhone } from "./format-phone";
import { ChatbotPanel } from "./chatbot/chatbot-panel";
import { ChatLayout } from "@/src/components/Reception/Chat/ChatLayout";
import { assignConversation, markConversationRead, setConversationClosed } from "./actions";
import { matchesFilter, matchesSearch } from "@/lib/atendimento/filters";
import type { ChatbotDashboardStats } from "./chatbot/dashboard-panel";
import type { FaqRow } from "./chatbot/faq-manager";
import type { QuickResponseRow } from "./chatbot/quick-responses-manager";
import type { TemplateRow } from "./chatbot/templates-manager";
import type { ChatbotSettingsRow } from "./chatbot/settings-panel";
import type { UnansweredQuestionRow } from "./chatbot/faq-manager";
import type { DeliveryHistoryRow } from "./chatbot/chatbot-panel";

export type { ConversationRow, InsurerPill, ConversationPatch } from "@/lib/atendimento/types";
import type { ConversationRow, ConversationPatch, InsurerPill } from "@/lib/atendimento/types";
import { hasPatientRecord, toLastMessageSender } from "@/lib/atendimento/types";

const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** true quando a janela de 24h do WhatsApp já fechou (ou nunca esteve
 * aberta — contato sem mensagem inbound registrada) e só um template
 * aprovado consegue reabrir a conversa. */
export function isWhatsappWindowClosed(conversation: Pick<ConversationRow, "lastInboundAt">): boolean {
  if (!conversation.lastInboundAt) return true;
  return Date.now() - new Date(conversation.lastInboundAt).getTime() > WHATSAPP_SERVICE_WINDOW_MS;
}

export type ChatbotAdminData = {
  clinicId: string;
  stats: ChatbotDashboardStats;
  faqs: FaqRow[];
  unanswered: UnansweredQuestionRow[];
  quickResponses: QuickResponseRow[];
  templates: TemplateRow[];
  deliveryHistory: DeliveryHistoryRow[];
  settings: ChatbotSettingsRow;
};

export function AtendimentoShell({
  initialConversations,
  chatbotAdmin,
  currentUserId,
  staffNames,
  insurerById,
  loadError = null,
}: {
  initialConversations: ConversationRow[];
  chatbotAdmin: ChatbotAdminData | null;
  currentUserId: string | null;
  staffNames: Record<string, string>;
  insurerById: Record<string, InsurerPill>;
  loadError?: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"conversas" | "chatbot">("conversas");
  const [filter, setFilter] = useState<ConversationFilter>("abertas");
  const [search, setSearch] = useState("");
  // Mobile: lista e conversa viram telas separadas (master-detail), em vez
  // de três painéis empilhados com o chat abaixo da dobra.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [showContextMobile, setShowContextMobile] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closedToast, setClosedToast] = useState<{ id: string; name: string } | null>(null);
  // Vizinha da conversa no momento em que o encerramento é pedido: depois do
  // patch otimista ela já saiu da lista e o índice se perderia.
  const closeNeighborRef = useRef<string | null>(null);

  useEffect(() => {
    if (!closedToast) return;
    const timer = setTimeout(() => setClosedToast(null), 8000);
    return () => clearTimeout(timer);
  }, [closedToast]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), 8000);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("atendimento-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "twilio_conversations", filter: `clinic_id=eq.${DEV_CLINIC_ID}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as {
            id: string;
            patient_id: string | null;
            guardian_id: string | null;
            phone_number: string;
            is_bot_active: boolean;
            status: string;
            unread_count: number;
            last_message_at: string | null;
            kind: string;
            contact_name: string | null;
            escalation_reason: string | null;
            assigned_to: string | null;
            insurer_id: string | null;
            last_inbound_at: string | null;
            last_message_preview: string | null;
            last_message_sender: string | null;
          };
          // Plano identificado pelo bot durante a conversa (a linha do realtime só traz ids).
          const detected: InsurerPill | null = row.insurer_id ? (insurerById[row.insurer_id] ?? null) : null;
          setConversations((prev) => {
            const existing = prev.find((c) => c.id === row.id);
            const updated: ConversationRow = existing
              ? {
                  ...existing,
                  patientId: row.patient_id,
                  // O realtime de twilio_conversations não traz o status do
                  // paciente (patients.status) — se o vínculo mudou, mantém
                  // o status conhecido até a próxima carga via server; não
                  // existe aqui dado melhor para decidir.
                  patientStatus: row.patient_id === existing.patientId ? existing.patientStatus : null,
                  guardianId: row.guardian_id,
                  kind: row.kind === "lead" ? "lead" : "patient",
                  isBotActive: row.is_bot_active,
                  status: row.status,
                  unreadCount: row.unread_count,
                  lastMessageAt: row.last_message_at,
                  escalationReason: row.escalation_reason,
                  assignedTo: row.assigned_to,
                  contactName: row.contact_name,
                  displayName: row.patient_id
                    ? existing.displayName
                    : (row.contact_name ?? formatConversationPhone(row.phone_number)),
                  insurerId: row.insurer_id,
                  lastInboundAt: row.last_inbound_at,
                  lastMessagePreview: row.last_message_preview,
                  lastMessageSender: toLastMessageSender(row.last_message_sender),
                  // Com paciente, o plano do cadastro (carregado no servidor) prevalece.
                  ...(!row.patient_id || !existing.planName
                    ? { planName: detected?.name ?? null, planColor: detected?.color ?? null }
                    : {}),
                }
              : {
                  id: row.id,
                  patientId: row.patient_id,
                  patientStatus: null,
                  guardianId: row.guardian_id,
                  phoneNumber: row.phone_number,
                  isBotActive: row.is_bot_active,
                  status: row.status,
                  unreadCount: row.unread_count,
                  lastMessageAt: row.last_message_at,
                  kind: row.kind === "lead" ? "lead" : "patient",
                  escalationReason: row.escalation_reason,
                  assignedTo: row.assigned_to,
                  contactName: row.contact_name,
                  displayName: row.contact_name ?? formatConversationPhone(row.phone_number),
                  guardianName: null,
                  planName: detected?.name ?? null,
                  planColor: detected?.color ?? null,
                  insurerId: row.insurer_id,
                  lastInboundAt: row.last_inbound_at,
                  lastMessagePreview: row.last_message_preview,
                  lastMessageSender: toLastMessageSender(row.last_message_sender),
                };
            const rest = prev.filter((c) => c.id !== row.id);
            return [updated, ...rest].sort((a, b) => {
              if (!a.lastMessageAt) return 1;
              if (!b.lastMessageAt) return -1;
              return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
            });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [insurerById]);

  const patchConversation = (id: string, patch: ConversationPatch) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const counts = useMemo(() => {
    const result: Record<ConversationFilter, number> = {
      abertas: 0,
      aguardando: 0,
      nao_lidas: 0,
      leads: 0,
      minhas: 0,
      encerradas: 0,
    };
    for (const c of conversations) {
      for (const key of Object.keys(result) as ConversationFilter[]) {
        if (matchesFilter(c, key, currentUserId)) result[key] += 1;
      }
    }
    return result;
  }, [conversations, currentUserId]);

  const visibleConversations = useMemo(
    () => conversations.filter((c) => matchesFilter(c, filter, currentUserId) && matchesSearch(c, search)),
    [conversations, filter, search, currentUserId],
  );

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const selectConversation = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("chat");
    setShowContextMobile(false);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    // Persiste no banco — sem isto o contador de não lidas voltava ao
    // recarregar a página, porque só o estado local em memória era
    // zerado (markConversationRead nunca era chamada).
    void markConversationRead(id);
  }, []);

  const handlePatchSelected = (patch: ConversationPatch) => {
    if (!selected) return;
    if (patch.status === "closed") {
      const idx = visibleConversations.findIndex((c) => c.id === selected.id);
      const neighbor = visibleConversations[idx + 1] ?? visibleConversations[idx - 1] ?? null;
      closeNeighborRef.current = neighbor?.id ?? null;
    }
    patchConversation(selected.id, patch);
  };

  // Confirmado pelo servidor: avisa e leva a recepção à próxima conversa da
  // fila, em vez de deixá-la num painel órfão (Peak-end).
  const handleClosed = () => {
    if (!selected) return;
    setClosedToast({ id: selected.id, name: selected.displayName });
    const nextId = closeNeighborRef.current;
    closeNeighborRef.current = null;
    if (filter !== "encerradas" && nextId) selectConversation(nextId);
    else setMobileView("list");
  };

  const handleUndoClose = async () => {
    if (!closedToast) return;
    const { id } = closedToast;
    setClosedToast(null);
    patchConversation(id, { status: "open" });
    const result = await setConversationClosed(id, false);
    if (!result.success) {
      patchConversation(id, { status: "closed" });
      setActionError(result.error || "Não foi possível reabrir a conversa.");
    }
  };

  const handleAssignActiveConversation = async () => {
    if (!selected) return;
    const isMine = Boolean(currentUserId) && selected.assignedTo === currentUserId;
    const shouldAssign = !isMine;
    const previous = { assignedTo: selected.assignedTo, isBotActive: selected.isBotActive };
    patchConversation(selected.id, {
      assignedTo: shouldAssign ? currentUserId : null,
      isBotActive: shouldAssign ? false : selected.isBotActive,
    });
    const result = await assignConversation(selected.id, shouldAssign);
    // Atalho Alt+A não mostrava nada em erro (sessão expirada, RLS) — a
    // recepção via a conversa marcada como "com Fulana" mesmo sem ter
    // gravado no banco. Desfaz o otimismo e avisa.
    if (!result.success) {
      patchConversation(selected.id, previous);
      setActionError(result.error || "Não foi possível assumir/liberar a conversa.");
    }
  };

  return (
    <ChatLayout
      conversations={visibleConversations}
      selectedId={selectedId}
      onSelectConversation={selectConversation}
      onAssignActiveConversation={handleAssignActiveConversation}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {chatbotAdmin && (
          <div className="flex gap-1 border-b border-paper-line-strong bg-paper px-4 pt-2">
            {(
              [
                { key: "conversas", label: "Conversas" },
                { key: "chatbot", label: "Chatbot" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key ? "border-b-2 border-accent text-ink" : "text-ink-faint hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {loadError && (
          <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            Não foi possível carregar as conversas: {loadError}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
          >
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="ml-3 text-xs font-semibold underline">
              Fechar
            </button>
          </div>
        )}

        {activeTab === "chatbot" && chatbotAdmin ? (
          <ChatbotPanel
            clinicId={chatbotAdmin.clinicId}
            stats={chatbotAdmin.stats}
            faqs={chatbotAdmin.faqs}
            unanswered={chatbotAdmin.unanswered}
            quickResponses={chatbotAdmin.quickResponses}
            templates={chatbotAdmin.templates}
            deliveryHistory={chatbotAdmin.deliveryHistory}
            settings={chatbotAdmin.settings}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div
              className={`min-h-0 w-full border-b border-paper-line-strong md:block md:w-80 md:border-b-0 md:border-r ${
                mobileView === "chat" ? "hidden" : "block"
              }`}
            >
              <ConversationList
                conversations={visibleConversations}
                selectedId={selectedId}
                filter={filter}
                counts={counts}
                search={search}
                staffNames={staffNames}
                currentUserId={currentUserId}
                onFilterChange={setFilter}
                onSearchChange={setSearch}
                onSelect={selectConversation}
              />
            </div>

            <div
              className={`min-h-[60vh] flex-1 flex-col md:flex md:min-h-0 ${mobileView === "chat" ? "flex" : "hidden"}`}
            >
              {selected && (
                <div className="flex items-center justify-between gap-2 border-b border-paper-line-strong bg-white px-3 py-2 md:hidden dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    className="min-h-10 rounded-md px-3 text-sm font-semibold text-teal-700 hover:bg-slate-100 dark:text-teal-300"
                  >
                    ← Conversas
                  </button>
                  <button
                    type="button"
                    aria-expanded={showContextMobile}
                    onClick={() => setShowContextMobile((v) => !v)}
                    className="min-h-10 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200"
                  >
                    {showContextMobile ? "Ocultar dados" : "Dados do contato"}
                  </button>
                </div>
              )}
              {selected ? (
                <ChatWindow
                  key={selected.id}
                  conversation={selected}
                  currentUserId={currentUserId}
                  staffNames={staffNames}
                  onPatch={handlePatchSelected}
                  onClosed={handleClosed}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
                  Selecione uma conversa para começar.
                </div>
              )}
            </div>

            {selected && (
              <div
                className={`w-full border-t border-paper-line-strong md:block md:w-80 md:border-t-0 md:border-l ${
                  mobileView === "chat" && showContextMobile ? "block" : "hidden"
                }`}
              >
                {hasPatientRecord(selected) ? (
                  <PatientContextPanel key={selected.id} conversation={selected} />
                ) : (
                  <LeadContextPanel
                    key={selected.id}
                    conversation={selected}
                    onPatch={(patch) => patchConversation(selected.id, patch)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {closedToast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
        >
          <span>Conversa com {closedToast.name} encerrada.</span>
          <button
            type="button"
            onClick={handleUndoClose}
            className="font-semibold text-teal-300 underline hover:text-teal-200"
          >
            Desfazer
          </button>
        </div>
      )}
    </ChatLayout>
  );
}
