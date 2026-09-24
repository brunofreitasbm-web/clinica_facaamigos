"use client";

import React, { useEffect, useState, useRef, useMemo, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bot, Search, User } from "lucide-react";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import { SubNavBadges, ConversationFilter } from "@/src/components/Reception/Navigation/SubNavBadges";
import type { ConversationRow } from "@/app/recepcao/atendimento/atendimento-shell";

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
  const waitMinutes = now !== null && c.status === "pending" ? minutesSince(c.lastMessageAt) : null;
  const waitAlert = waitMinutes !== null && waitMinutes >= WAIT_ALERT_MINUTES;
  const assigneeName = c.assignedTo
    ? c.assignedTo === currentUserId
      ? "você"
      : (staffNames[c.assignedTo]?.split(" ")[0] ?? "equipe")
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      aria-selected={isSelected}
      className={`flex h-[72px] w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left transition-colors dark:border-slate-800 ${
        isSelected
          ? "bg-teal-50/80 border-l-4 border-l-teal-600 dark:bg-slate-800/80"
          : "hover:bg-slate-50 dark:hover:bg-slate-900"
      }`}
      style={{
        boxShadow: waitAlert ? "inset 3px 0 0 #dc2626" : undefined,
      }}
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

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.displayName}</span>
          {c.kind === "lead" && (
            <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              Lead
            </span>
          )}
          {c.isBotActive ? (
            <Bot size={13} className="shrink-0 text-slate-400" />
          ) : (
            <User size={13} className="shrink-0 text-emerald-600" />
          )}
          {c.planName && <HealthPlanBadge name={c.planName} color={c.planColor} size="sm" />}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {c.guardianName ?? c.phoneNumber}
        </span>
        {(waitMinutes !== null || assigneeName) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
            {waitMinutes !== null && (
              <span
                className={`rounded-full px-1.5 py-0.5 ${
                  waitAlert
                    ? "bg-red-600 text-white"
                    : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                }`}
              >
                Aguardando · {waitMinutes < 1 ? "agora" : relativeTime(c.lastMessageAt)}
              </span>
            )}
            {assigneeName && <span className="text-slate-500 dark:text-slate-400">com {assigneeName}</span>}
          </span>
        )}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{now !== null ? relativeTime(c.lastMessageAt) : ""}</span>
        {c.unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white shadow-2xs">
            {c.unreadCount}
          </span>
        )}
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
        <SubNavBadges currentFilter={filter} counts={counts} onFilterChange={onFilterChange} />
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
