"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { PatientContextPanel } from "./patient-context-panel";

export type ConversationRow = {
  id: string;
  patientId: string;
  guardianId: string | null;
  phoneNumber: string;
  isBotActive: boolean;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  patientName: string;
  guardianName: string | null;
  lastMessagePreview?: string | null;
};

export function AtendimentoShell({ initialConversations }: { initialConversations: ConversationRow[] }) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);

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
            patient_id: string;
            guardian_id: string | null;
            phone_number: string;
            is_bot_active: boolean;
            status: string;
            unread_count: number;
            last_message_at: string | null;
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
                  patientName: "Paciente",
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
          <PatientContextPanel patientId={selected.patientId} />
        </div>
      )}
    </div>
  );
}
