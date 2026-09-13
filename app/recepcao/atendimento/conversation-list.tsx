"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Search, User } from "lucide-react";
import { markConversationRead } from "./actions";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import type { ConversationRow } from "./atendimento-shell";

export type ConversationFilter = "abertas" | "aguardando" | "nao_lidas" | "leads" | "minhas" | "encerradas";

const FILTERS: { key: ConversationFilter; label: string }[] = [
  { key: "abertas", label: "Abertas" },
  { key: "aguardando", label: "Aguardando" },
  { key: "nao_lidas", label: "Não lidas" },
  { key: "leads", label: "Leads" },
  { key: "minhas", label: "Minhas" },
  { key: "encerradas", label: "Encerradas" },
];

/** A partir daqui a espera de uma conversa escalada vira alerta vermelho. */
const WAIT_ALERT_MINUTES = 15;

function initialsOf(name: string): string {
  // Conversa de lead cai aqui com o telefone formatado como nome — nesse caso
  // as "iniciais" seriam pontuação, então usa um marcador neutro.
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

// Depende de Date.now(), então só pode ser calculado depois da montagem no
// cliente — calcular durante o SSR causa mismatch de hidratação (o instante
// do render no servidor difere do instante da hidratação no navegador).
// Reavalia a cada minuto para a espera da fila não congelar na tela.
function useNowTick(): number | null {
  // Começa nulo (SSR-safe) e já nasce com o instante atual assim que o
  // componente monta no cliente — sem depender de um setState síncrono
  // dentro do corpo do efeito, só a resposta ao timer.
  const [now, setNow] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
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
}: {
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
}) {
  const [, startTransition] = useTransition();
  const now = useNowTick();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-paper-line-strong p-3">
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            className="input w-full pl-8 text-sm"
            placeholder="Buscar nome ou telefone"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            const alert = f.key === "aguardando" && counts.aguardando > 0;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterChange(f.key)}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: active ? "var(--color-accent)" : "var(--color-paper-line-strong, #e5e0d8)",
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "#fff" : "var(--color-ink-soft)",
                }}
              >
                {f.label}
                <span
                  className="rounded-full px-1 text-[10px]"
                  style={{
                    background: active ? "rgba(255,255,255,0.25)" : alert ? "#dc2626" : "var(--color-neutral-100)",
                    color: active || alert ? "#fff" : "var(--color-ink-faint)",
                  }}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {conversations.map((c) => {
          const isSelected = c.id === selectedId;
          const waitMinutes = now !== null && c.status === "pending" ? minutesSince(c.lastMessageAt) : null;
          const waitAlert = waitMinutes !== null && waitMinutes >= WAIT_ALERT_MINUTES;
          const assigneeName = c.assignedTo
            ? c.assignedTo === currentUserId
              ? "você"
              : (staffNames[c.assignedTo]?.split(" ")[0] ?? "equipe")
            : null;

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                startTransition(() => {
                  markConversationRead(c.id);
                });
              }}
              className="flex w-full items-center gap-3 border-b border-paper-line px-4 py-3 text-left transition-colors"
              style={{
                background: isSelected ? "var(--color-accent-2-100)" : "transparent",
                boxShadow: waitAlert ? "inset 3px 0 0 #dc2626" : undefined,
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: "var(--color-accent-2-100)",
                  color: "var(--color-accent-2-700)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {initialsOf(c.displayName)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-ink">{c.displayName}</span>
                  {c.kind === "lead" && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
                    >
                      Lead
                    </span>
                  )}
                  {c.isBotActive ? (
                    <Bot size={13} className="shrink-0 text-ink-faint" />
                  ) : (
                    <User size={13} className="shrink-0 text-status-active" />
                  )}
                  {c.planName && <HealthPlanBadge name={c.planName} color={c.planColor} size="sm" />}
                </span>
                <span className="block truncate text-xs text-ink-faint">
                  {c.guardianName ?? c.phoneNumber}
                </span>
                {(waitMinutes !== null || assigneeName) && (
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                    {waitMinutes !== null && (
                      <span
                        className="rounded-full px-1.5 py-0.5"
                        style={{
                          background: waitAlert ? "#dc2626" : "var(--color-accent-2-100)",
                          color: waitAlert ? "#fff" : "var(--color-accent-2-700)",
                        }}
                      >
                        Aguardando · {waitMinutes < 1 ? "agora" : relativeTime(c.lastMessageAt)}
                      </span>
                    )}
                    {assigneeName && <span className="text-ink-faint">com {assigneeName}</span>}
                  </span>
                )}
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-ink-faint">{now !== null ? relativeTime(c.lastMessageAt) : ""}</span>
                {c.unreadCount > 0 && (
                  <span
                    className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {conversations.length === 0 && (
          <p className="p-4 text-sm text-ink-faint">
            {search.trim() ? "Nenhuma conversa encontrada." : "Nenhuma conversa neste filtro."}
          </p>
        )}
      </div>
    </div>
  );
}
