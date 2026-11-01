"use client";

import React, { useEffect, useState, useRef, useMemo, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import { SubNavBadges, ConversationFilter } from "@/src/components/Reception/Navigation/SubNavBadges";
import type { ConversationRow } from "@/app/recepcao/atendimento/atendimento-shell";
import { LastSenderIndicator } from "@/components/atendimento/last-sender-indicator";
import { waitingSince } from "@/lib/atendimento/waiting";
import { isPriorityEscalation, priorityLabel } from "@/lib/atendimento/priority-pure";

const WAIT_ALERT_MINUTES = 15;

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

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function relativeTime(iso: string | null): string {
  const minutes = minutesSince(iso);
  if (minutes === null) return "";
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
}

function useNowTick(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface ConversationItemProps {
  conversation: ConversationRow;
  isSelected: boolean;
  now: number | null;
  staffNames: Record<string, string>;
  currentUserId: string | null;
  onSelect: (id: string) => void;
}

const ConversationItem = React.memo(function ConversationItem({
  conversation: c,
  isSelected,
  now,
  staffNames,
  currentUserId,
  onSelect,
}: ConversationItemProps) {
  const waitStart = waitingSince(c);
  const waitMinutes = now !== null && waitStart ? minutesSince(waitStart) : null;
  const isPriority = isPriorityEscalation(c);
  const waitAlert = isPriority || (waitMinutes !== null && waitMinutes >= WAIT_ALERT_MINUTES);
  const assigneeName = c.assignedTo
    ? c.assignedTo === currentUserId
      ? "você"
      : (staffNames[c.assignedTo]?.split(" ")[0] ?? "equipe")
    : null;

  // Selecionado e urgente usavam a mesma borda esquerda (e o border-l-4
  // ainda empurrava o conteúdo 4px). Agora tudo é inset shadow: a urgência
  // (vermelho) prevalece na faixa, e a seleção também aparece no contorno.
  const shadows: string[] = [];
  if (waitAlert) shadows.push("inset 4px 0 0 #dc2626");
  else if (isSelected) shadows.push("inset 4px 0 0 #0d9488");
  if (isSelected && waitAlert) shadows.push("inset 0 0 0 2px #0d9488");

  // Um único sinal de "quem responde" (menos ruído que ícone + texto).
  const handlerLabel = assigneeName ? `com ${assigneeName}` : !c.isBotActive ? "Humano" : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      aria-current={isSelected ? "true" : undefined}
      className={`flex h-[72px] w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left transition-colors dark:border-slate-800 ${
        isSelected ? "bg-teal-50 dark:bg-slate-800/80" : "hover:bg-slate-50 dark:hover:bg-slate-900"
      }`}
      style={{ boxShadow: shadows.length ? shadows.join(", ") : undefined }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-2xs"
        style={{
          background: "var(--color-accent-2-100, #e0f2fe)",
          color: "var(--color-accent-2-700, #0369a1)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {initialsOf(c.displayName)}
      </span>

      {/* Linha 1: quem. Linha 2: o quê. Linha 3: só o que exige ação ou contexto. */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.displayName}</span>
          <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">
            {now !== null ? relativeTime(c.lastMessageAt) : ""}
          </span>
        </span>
        <span
          className={`flex min-w-0 items-center justify-between gap-2 text-xs ${
            c.lastMessageSender === "contact"
              ? "font-medium text-slate-800 dark:text-slate-200"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          <span className="flex min-w-0 items-center gap-1">
            <LastSenderIndicator sender={c.lastMessageSender} />
            <span className="truncate">{c.lastMessagePreview || c.guardianName || c.phoneNumber}</span>
          </span>
          {c.unreadCount > 0 && (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] font-bold text-white shadow-2xs"
              aria-label={`${c.unreadCount} não lidas`}
            >
              {c.unreadCount}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] font-semibold">
          {isPriority ? (
            <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-white motion-safe:animate-pulse">
              {priorityLabel(c.escalationReason)}
            </span>
          ) : waitMinutes !== null ? (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 ${
                waitAlert ? "bg-red-600 text-white" : "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300"
              }`}
            >
              Aguardando · {waitMinutes < 1 ? "agora" : relativeTime(waitStart)}
            </span>
          ) : (
            handlerLabel && <span className="shrink-0 text-slate-600 dark:text-slate-400">{handlerLabel}</span>
          )}
          {c.kind === "lead" && (
            <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-sky-900 dark:bg-sky-950 dark:text-sky-300">
              Lead
            </span>
          )}
          {c.planName && <HealthPlanBadge name={c.planName} color={c.planColor} size="sm" />}
        </span>
      </span>
    </button>
  );
});

export interface ConversationListProps {
  conversations: ConversationRow[];
  selectedId: string | null;
  filter: ConversationFilter;
  counts: Record<ConversationFilter, number>;
  search: string;
  staffNames: Record<string, string>;
  currentUserId: string | null;
  onFilterChange: (filter: ConversationFilter) => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  filter,
  counts,
  search,
  staffNames,
  currentUserId,
  onFilterChange,
  onSearchChange,
  onSelect,
}: ConversationListProps) {
  const [, startTransition] = useTransition();
  const now = useNowTick();
  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce de 250ms no input de busca para digitação extremamente fluida sem atraso de frames
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        onSearchChange(val);
      });
    }, 250);
  };

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-9 text-sm focus:ring-2 focus:ring-teal-600"
            placeholder="Buscar nome ou telefone"
            value={searchInput}
            onChange={handleSearchInputChange}
            aria-label="Buscar conversa por nome ou telefone"
          />
        </label>
        <SubNavBadges
          currentFilter={filter}
          counts={counts}
          onFilterChange={onFilterChange}
          collapsedKeys={["leads", "encerradas"]}
        />
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto h-[calc(100vh-180px)] min-h-0"
        style={{ contain: "strict" }}
      >
        {conversations.length > 0 ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const c = conversations[virtualRow.index];
              return (
                <div
                  key={c.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ConversationItem
                    conversation={c}
                    isSelected={c.id === selectedId}
                    now={now}
                    staffNames={staffNames}
                    currentUserId={currentUserId}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {search.trim() ? "Nenhuma conversa encontrada." : "Nenhuma conversa neste filtro."}
          </p>
        )}
      </div>
    </div>
  );
}
