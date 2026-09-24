import type { ConversationFilter } from "@/src/components/Reception/Navigation/SubNavBadges";
import type { ConversationRow } from "./types";

export type { ConversationFilter };

/**
 * Extraído de app/recepcao/atendimento/atendimento-shell.tsx (pura, sem
 * mudança de comportamento) — usado tanto pelo desktop quanto pelo PWA
 * mobile pra decidir quais conversas aparecem em cada aba/chip de filtro.
 */
export function matchesFilter(c: ConversationRow, filter: ConversationFilter, currentUserId: string | null): boolean {
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

export function matchesSearch(c: ConversationRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && c.phoneNumber.replace(/\D/g, "").includes(digits)) return true;
  return [c.displayName, c.guardianName, c.contactName].some((v) => v?.toLowerCase().includes(q));
}
