"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { PatientContextPanel } from "./patient-context-panel";
import { LeadContextPanel } from "./lead-context-panel";
import { formatConversationPhone } from "./format-phone";
import { ChatbotPanel } from "./chatbot/chatbot-panel";
import type { ChatbotDashboardStats } from "./chatbot/dashboard-panel";
import type { FaqRow } from "./chatbot/faq-manager";
import type { QuickResponseRow } from "./chatbot/quick-responses-manager";
import type { TemplateRow } from "./chatbot/templates-manager";
import type { ChatbotSettingsRow } from "./chatbot/settings-panel";
import type { DeliveryHistoryRow } from "./chatbot/chatbot-panel";

export type ConversationRow = {
  id: string;
  /** Nulo em conversa de lead — número que ainda não casa com nenhum
   * responsável cadastrado (ver migration 20260909100000). */
  patientId: string | null;
  guardianId: string | null;
  phoneNumber: string;
  isBotActive: boolean;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  kind: "patient" | "lead";
  escalationReason: string | null;
  displayName: string;
  guardianName: string | null;
  lastMessagePreview?: string | null;
};

export type ChatbotAdminData = {
  clinicId: string;
  stats: ChatbotDashboardStats;
  faqs: FaqRow[];
  quickResponses: QuickResponseRow[];
  templates: TemplateRow[];
  deliveryHistory: DeliveryHistoryRow[];
  settings: ChatbotSettingsRow;
};

export function AtendimentoShell({
  initialConversations,
  chatbotAdmin,
}: {
  initialConversations: ConversationRow[];
  /** Só vem preenchido quando o usuário logado é supervisor ou gestor — ver
   * app/recepcao/atendimento/page.tsx. Recepção não vê a aba Chatbot. */
  chatbotAdmin: ChatbotAdminData | null;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"conversas" | "chatbot">("conversas");

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
          };
          setConversations((prev) => {
            const existing = prev.find((c) => c.id === row.id);
            const updated: ConversationRow = existing
              ? {
                  ...existing,
                  isBotActive: row.is_bot_active,
                  status: row.status,
                  unreadCount: row.unread_count,
                  lastMessageAt: row.last_message_at,
                  escalationReason: row.escalation_reason,
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
                  // O payload do Realtime não traz o join com `patients`;
                  // sem recarregar, o telefone é o melhor rótulo disponível.
                  displayName: row.contact_name ?? formatConversationPhone(row.phone_number),
                  guardianName: null,
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
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
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
          <div className="w-full border-b border-paper-line-strong md:w-72 md:border-b-0 md:border-r">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
              }}
            />
          </div>

          <div className="flex min-h-[60vh] flex-1 flex-col md:min-h-0">
            {selected ? (
              <ChatWindow conversation={selected} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
                Selecione uma conversa para começar.
              </div>
            )}
          </div>

          {selected && (
            <div className="w-full border-t border-paper-line-strong md:w-80 md:border-t-0 md:border-l">
              {selected.patientId ? (
                <PatientContextPanel patientId={selected.patientId} />
              ) : (
                <LeadContextPanel conversation={selected} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
