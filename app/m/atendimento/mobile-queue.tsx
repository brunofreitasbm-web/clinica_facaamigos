"use client";

import { useEffect, useState } from "react";
import { Bot, Search, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import type { ConversationFilter } from "@/lib/atendimento/filters";
import type { ConversationRow } from "@/lib/atendimento/types";

export type MobileTab = "conversas" | "leads" | "encerradas";

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
  const [now, setNow] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const TABS: { key: MobileTab; label: string }[] = [
  { key: "conversas", label: "Conversas" },
  { key: "leads", label: "Leads" },
  { key: "encerradas", label: "Encerradas" },
];

const CHIPS: { key: ConversationFilter; label: string }[] = [
  { key: "abertas", label: "Abertas" },
  { key: "aguardando", label: "Aguardando" },
  { key: "nao_lidas", label: "Não lidas" },
  { key: "minhas", label: "Minhas" },
];

export function MobileQueue({
  conversations,
  tab,
  chip,
  search,
  searchOpen,
  waitingCount,
  chipCounts,
  tabCounts,
  currentUserId,
  staffNames,
  onTabChange,
  onChipChange,
  onSearchChange,
  onSearchOpenChange,
  onSelect,
}: {
  conversations: ConversationRow[];
  tab: MobileTab;
  chip: ConversationFilter;
  search: string;
  searchOpen: boolean;
  waitingCount: number;
  chipCounts: Record<ConversationFilter, number>;
  tabCounts: { conversas: number; leads: number; encerradas: number };
  currentUserId: string | null;
  staffNames: Record<string, string>;
  onTabChange: (tab: MobileTab) => void;
  onChipChange: (chip: ConversationFilter) => void;
  onSearchChange: (value: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const now = useNowTick();

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "var(--color-surface)" }}>
      {/* Header */}
      <header
        className="shrink-0"
        style={{
          background: "var(--color-accent)",
          color: "#fff",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          paddingInline: 16,
          paddingBottom: 0,
        }}
      >
        <div className="flex items-center gap-3" style={{ minHeight: 44 }}>
          <Logo variant="simbolo" tone="branco" height={26} />
          <h1
            className="min-w-0 flex-1 truncate"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 22,
              letterSpacing: "-0.01em",
              color: "#fff",
              margin: 0,
            }}
          >
            Atendimento
          </h1>
          {!searchOpen && (
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: "color-mix(in srgb, #fff 14%, transparent)" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-error)" }} />
              {waitingCount} aguardando
            </span>
          )}
          <button
            type="button"
            aria-label={searchOpen ? "Fechar busca" : "Buscar conversa"}
            onClick={() => onSearchOpenChange(!searchOpen)}
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              background: searchOpen ? "color-mix(in srgb, #fff 14%, transparent)" : "transparent",
              color: "#fff",
            }}
          >
            <Search size={18} />
          </button>
        </div>

        {searchOpen ? (
          <div className="flex items-center gap-2" style={{ marginTop: 6, paddingBottom: 10 }}>
            <label className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-neutral-400)" }}
              />
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onSearchOpenChange(false);
                }}
                placeholder="Buscar nome ou telefone"
                aria-label="Buscar conversa por nome ou telefone"
                className="w-full rounded-full border-0 text-[15px]"
                style={{ height: 44, padding: "10px 40px", background: "#fff", color: "var(--color-text)" }}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => onSearchChange("")}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ background: "var(--color-neutral-200)" }}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => onSearchOpenChange(false)}
              className="shrink-0 text-[15px] font-bold"
              style={{ color: "#fff", minHeight: 44 }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex gap-1" role="tablist" aria-label="Abas do Atendimento" style={{ marginTop: 6 }}>
            {TABS.map((t) => {
              const active = t.key === tab;
              const count = tabCounts[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(t.key)}
                  className="flex flex-1 items-center justify-center gap-1.5 text-[14px] font-bold"
                  style={{
                    padding: "10px 8px",
                    minHeight: 44,
                    borderTopLeftRadius: 14,
                    borderTopRightRadius: 14,
                    color: active ? "#fff" : "color-mix(in srgb, #fff 88%, transparent)",
                    background: active ? "color-mix(in srgb, #fff 14%, transparent)" : "transparent",
                    borderBottom: active ? "3px solid #fff" : "3px solid transparent",
                  }}
                >
                  {t.label}
                  <span
                    className="inline-flex items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                    style={{
                      minWidth: 20,
                      height: 20,
                      padding: "0 6px",
                      background: active ? "#fff" : "color-mix(in srgb, #fff 18%, transparent)",
                      color: active ? "var(--color-text)" : "#fff",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Chips de sub-filtro — só na aba Conversas, escondidos com busca ativa */}
      {tab === "conversas" && !searchOpen && (
        <div
          className="flex shrink-0 gap-1.5 overflow-x-auto"
          style={{
            background: "#fff",
            padding: "10px 16px",
            borderBottom: "1px solid var(--color-paper-line-strong)",
          }}
        >
          {CHIPS.map((c) => {
            const active = c.key === chip;
            const count = chipCounts[c.key];
            const isWaitAlert = c.key === "aguardando" && count > 0;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onChipChange(c.key)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-[12px] font-bold"
                style={{
                  padding: "6px 12px",
                  minHeight: 32,
                  border: `1.5px solid ${active ? "var(--color-accent)" : "var(--color-neutral-300)"}`,
                  background: active ? "var(--color-accent)" : "#fff",
                  color: active ? "#fff" : "var(--color-text)",
                }}
              >
                {c.label}
                <span
                  className="inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                  style={{
                    minWidth: 18,
                    height: 16,
                    padding: "0 5px",
                    background: active
                      ? "color-mix(in srgb, #fff 22%, transparent)"
                      : isWaitAlert
                        ? "var(--color-error)"
                        : "var(--color-neutral-200)",
                    color: active ? "#fff" : isWaitAlert ? "#fff" : "var(--color-neutral-800)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ background: "#fff" }}>
        {conversations.length === 0 ? (
          <p className="text-center text-[14px]" style={{ padding: "32px 16px", color: "var(--color-ink-faint)" }}>
            {search.trim() ? "Nenhuma conversa encontrada." : "Nenhuma conversa neste filtro."}
          </p>
        ) : (
          conversations.map((c) => {
            const waitMinutes = now !== null && c.status === "pending" ? minutesSince(c.lastMessageAt) : null;
            const waitAlert = waitMinutes !== null && waitMinutes >= WAIT_ALERT_MINUTES;
            const assigneeName = c.assignedTo
              ? c.assignedTo === currentUserId
                ? "você"
                : (staffNames[c.assignedTo]?.split(" ")[0] ?? "equipe")
              : null;
            const isUnread = c.unreadCount > 0;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex w-full items-center gap-3 text-left"
                style={{
                  minHeight: 64,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--color-paper-line)",
                  boxShadow: waitAlert ? "inset 3px 0 0 var(--color-error)" : undefined,
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
                  style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
                >
                  {initialsOf(c.displayName)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-bold" style={{ color: "var(--color-text)" }}>
                      {c.displayName}
                    </span>
                    {c.kind === "lead" && (
                      <span
                        className="shrink-0 rounded-full text-[10px] font-extrabold uppercase"
                        style={{
                          background: "var(--color-accent-100)",
                          color: "var(--color-accent-700)",
                          padding: "1px 6px",
                        }}
                      >
                        Lead
                      </span>
                    )}
                    {c.planName && <HealthPlanBadge name={c.planName} color={c.planColor} size="sm" />}
                  </span>
                  <span
                    className="mt-0.5 flex items-center gap-1.5 truncate text-[13px]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {c.isBotActive && <Bot size={13} className="shrink-0" style={{ color: "var(--color-neutral-400)" }} />}
                    {waitMinutes !== null && (
                      <span
                        className="shrink-0 rounded-full text-[10px] font-extrabold"
                        style={{
                          padding: "1px 6px",
                          background: waitAlert ? "var(--color-error)" : "var(--color-accent-100)",
                          color: waitAlert ? "#fff" : "var(--color-accent-700)",
                        }}
                      >
                        Aguardando · {waitMinutes < 1 ? "agora" : relativeTime(c.lastMessageAt)}
                      </span>
                    )}
                    <span className="truncate">
                      {c.lastMessagePreview
                        ? c.lastMessagePreview
                        : (c.guardianName ?? c.phoneNumber)}
                    </span>
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="text-[11px] font-semibold"
                    style={{
                      color: waitAlert
                        ? "var(--color-error)"
                        : isUnread
                          ? "var(--color-accent)"
                          : "var(--color-neutral-400)",
                    }}
                  >
                    {now !== null ? relativeTime(c.lastMessageAt) : ""}
                  </span>
                  {isUnread && (
                    <span
                      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white"
                      style={{ background: "var(--color-accent)" }}
                    >
                      {c.unreadCount}
                    </span>
                  )}
                  {assigneeName && (
                    <span className="text-[10px] font-bold" style={{ color: "var(--color-ink-faint)" }}>
                      com {assigneeName}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
