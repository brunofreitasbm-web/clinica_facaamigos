"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConversationList, type ConversationFilter } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { PatientContextPanel } from "./patient-context-panel";
import { LeadContextPanel } from "./lead-context-panel";
import { formatConversationPhone } from "./format-phone";
import { ChatbotPanel } from "./chatbot/chatbot-panel";
import { ChatLayout } from "@/src/components/Reception/Chat/ChatLayout";
import { assignConversation, markConversationRead } from "./actions";
import type { ChatbotDashboardStats } from "./chatbot/dashboard-panel";
import type { FaqRow } from "./chatbot/faq-manager";
import type { QuickResponseRow } from "./chatbot/quick-responses-manager";
import type { TemplateRow } from "./chatbot/templates-manager";
import type { ChatbotSettingsRow } from "./chatbot/settings-panel";
import type { DeliveryHistoryRow } from "./chatbot/chatbot-panel";

export type ConversationRow = {
  id: string;
  patientId: string | null;
  guardianId: string | null;
  phoneNumber: string;
  isBotActive: boolean;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  kind: "patient" | "lead";
  escalationReason: string | null;
  assignedTo: string | null;
  contactName: string | null;
  displayName: string;
  guardianName: string | null;
  planName: string | null;
  planColor: string | null;
  /** Convênio cadastrado que o chatbot identificou (só conta quando a conversa não tem plano de cadastro). */
  insurerId: string | null;
  lastMessagePreview?: string | null;
  /** Última mensagem RECEBIDA do contato — usado para saber se a janela de
   * serviço de 24h do WhatsApp está fechada (ver WINDOW_CLOSED_MS abaixo). */
  lastInboundAt: string | null;
};

const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** true quando a janela de 24h do WhatsApp já fechou (ou nunca esteve
 * aberta — contato sem mensagem inbound registrada) e só um template
 * aprovado consegue reabrir a conversa. */
export function isWhatsappWindowClosed(conversation: Pick<ConversationRow, "lastInboundAt">): boolean {
  if (!conversation.lastInboundAt) return true;
  return Date.now() - new Date(conversation.lastInboundAt).getTime() > WHATSAPP_SERVICE_WINDOW_MS;
}

export type InsurerPill = { name: string; color: string | null };

export type ConversationPatch = Partial<Omit<ConversationRow, "id">>;

export type ChatbotAdminData = {
  clinicId: string;
  stats: ChatbotDashboardStats;
  faqs: FaqRow[];
  quickResponses: QuickResponseRow[];
  templates: TemplateRow[];
  deliveryHistory: DeliveryHistoryRow[];
  settings: ChatbotSettingsRow;
};

function matchesFilter(c: ConversationRow, filter: ConversationFilter, currentUserId: string | null): boolean {
  if (filter === "encerradas") return c.status === "closed";
  if (c.status === "closed") return false;
  switch (filter) {
    case "aguardando":
      return c.status === "pending";
    case "nao_lidas":
      return c.unreadCount > 0;
    case "leads":
      return c.kind === "lead";
    case "minhas":
      return Boolean(currentUserId) && c.assignedTo === currentUserId;
    default:
      return true;
  }
}

function matchesSearch(c: ConversationRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && c.phoneNumber.replace(/\D/g, "").includes(digits)) return true;
  return [c.displayName, c.guardianName, c.contactName].some((v) => v?.toLowerCase().includes(q));
}

export function AtendimentoShell({
  initialConversations,
  chatbotAdmin,
  currentUserId,
  staffNames,
  insurerById,
}: {
  initialConversations: ConversationRow[];
  chatbotAdmin: ChatbotAdminData | null;
  currentUserId: string | null;
  staffNames: Record<string, string>;
  insurerById: Record<string, InsurerPill>;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"conversas" | "chatbot">("conversas");
  const [filter, setFilter] = useState<ConversationFilter>("abertas");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("atendimento-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "twilio_conversations" },
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
          };
          // Plano identificado pelo bot durante a conversa (a linha do realtime só traz ids).
          const detected: InsurerPill | null = row.insurer_id ? (insurerById[row.insurer_id] ?? null) : null;
          setConversations((prev) => {
            const existing = prev.find((c) => c.id === row.id);
            const updated: ConversationRow = existing
              ? {
                  ...existing,
                  patientId: row.patient_id,
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
                  // Com paciente, o plano do cadastro (carregado no servidor) prevalece.
                  ...(!row.patient_id || !existing.planName
                    ? { planName: detected?.name ?? null, planColor: detected?.color ?? null }
                    : {}),
                }
              : {
                  id: row.id,
                  patientId: row.patient_id,
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
      window.alert(result.error || "Não foi possível assumir/liberar a conversa.");
    }
  };

  return (
    <ChatLayout
      conversations={visibleConversations}
      selectedId={selectedId}
      onSelectConversation={(id) => {
        setSelectedId(id);
        patchConversation(id, { unreadCount: 0 });
        // Persiste no banco — sem isto o contador de não lidas voltava ao
        // recarregar a página, porque só o estado local em memória era
        // zerado (markConversationRead nunca era chamada).
        void markConversationRead(id);
      }}
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

        {activeTab === "chatbot" && chatbotAdmin ? (
          <ChatbotPanel
            clinicId={chatbotAdmin.clinicId}
            stats={chatbotAdmin.stats}
            faqs={chatbotAdmin.faqs}
            quickResponses={chatbotAdmin.quickResponses}
            templates={chatbotAdmin.templates}
            deliveryHistory={chatbotAdmin.deliveryHistory}
            settings={chatbotAdmin.settings}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="w-full border-b border-paper-line-strong md:w-80 md:border-b-0 md:border-r">
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
                onSelect={(id) => {
                  setSelectedId(id);
                  patchConversation(id, { unreadCount: 0 });
                  void markConversationRead(id);
                }}
              />
            </div>

            <div className="flex min-h-[60vh] flex-1 flex-col md:min-h-0">
              {selected ? (
                <ChatWindow
                  conversation={selected}
                  currentUserId={currentUserId}
                  staffNames={staffNames}
                  onPatch={(patch) => patchConversation(selected.id, patch)}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
                  Selecione uma conversa para começar.
                </div>
              )}
            </div>

            {selected && (
              <div className="w-full border-t border-paper-line-strong md:w-80 md:border-t-0 md:border-l">
                {selected.patientId ? (
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
    </ChatLayout>
  );
}
