"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatConversationPhone } from "@/app/recepcao/atendimento/format-phone";
import { matchesFilter, matchesSearch, type ConversationFilter } from "@/lib/atendimento/filters";
import type { ConversationPatch, ConversationRow, InsurerPill } from "@/lib/atendimento/types";
import { MobileQueue, type MobileTab } from "./mobile-queue";
import { MobileChat } from "./mobile-chat";

export function MobileShell({
  initialConversations,
  staffNames,
  insurerById,
  currentUserId,
  initialSelectedId,
}: {
  initialConversations: ConversationRow[];
  staffNames: Record<string, string>;
  insurerById: Record<string, InsurerPill>;
  currentUserId: string | null;
  initialSelectedId: string | null;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [tab, setTab] = useState<MobileTab>("conversas");
  const [chip, setChip] = useState<ConversationFilter>("abertas");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  // Realtime das conversas — mesmo padrão de app/recepcao/atendimento/atendimento-shell.tsx
  // (extração pura ainda não compartilhada em hook por causa do formato distinto
  // do estado do desktop [seleção/painel lateral] vs. mobile [tela cheia empilhada]).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("m-atendimento-conversations")
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
          };
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

  const patchConversation = useCallback((id: string, patch: ConversationPatch) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const chipFilterForTab: ConversationFilter = tab === "leads" ? "leads" : tab === "encerradas" ? "encerradas" : chip;

  // Contagens dos chips "Abertas/Aguardando/Não lidas/Minhas" (aba Conversas)
  // e das 3 abas do topo — mesma regra de matchesFilter do desktop.
  const chipCounts = useMemo(() => {
    const keys: ConversationFilter[] = ["abertas", "aguardando", "nao_lidas", "minhas"];
    const result = {} as Record<ConversationFilter, number>;
    for (const key of keys) result[key] = conversations.filter((c) => matchesFilter(c, key, currentUserId)).length;
    return result;
  }, [conversations, currentUserId]);

  const tabCounts = useMemo(
    () => ({
      conversas: conversations.filter((c) => matchesFilter(c, "abertas", currentUserId)).length,
      leads: conversations.filter((c) => matchesFilter(c, "leads", currentUserId)).length,
      encerradas: conversations.filter((c) => matchesFilter(c, "encerradas", currentUserId)).length,
    }),
    [conversations, currentUserId],
  );

  const waitingCount = useMemo(() => conversations.filter((c) => c.status === "pending").length, [conversations]);

  // Com texto digitado, a busca ignora a aba/chip atual e olha abertas + encerradas.
  const visibleConversations = useMemo(() => {
    if (search.trim()) return conversations.filter((c) => matchesSearch(c, search));
    return conversations.filter((c) => matchesFilter(c, chipFilterForTab, currentUserId));
  }, [conversations, chipFilterForTab, search, currentUserId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const openConversation = (id: string) => {
    patchConversation(id, { unreadCount: 0 });
    setSelectedId(id);
    router.push(`/m/atendimento/${id}`);
  };

  const closeConversation = () => {
    setSelectedId(null);
    router.push("/m/atendimento");
  };

  if (selected) {
    return (
      <MobileChat
        conversation={selected}
        currentUserId={currentUserId}
        staffNames={staffNames}
        onBack={closeConversation}
        onPatch={(patch) => patchConversation(selected.id, patch)}
      />
    );
  }

  return (
    <MobileQueue
      conversations={visibleConversations}
      tab={tab}
      chip={chip}
      search={search}
      searchOpen={searchOpen}
      waitingCount={waitingCount}
      chipCounts={chipCounts}
      tabCounts={tabCounts}
      currentUserId={currentUserId}
      staffNames={staffNames}
      onTabChange={(next) => {
        setTab(next);
        setSearchOpen(false);
        setSearch("");
      }}
      onChipChange={setChip}
      onSearchChange={setSearch}
      onSearchOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) setSearch("");
      }}
      onSelect={openConversation}
    />
  );
}
