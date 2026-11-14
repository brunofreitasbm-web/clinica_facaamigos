import { isPathAllowedForRole, ROLES, type Role } from "./roles.ts";

/** Destino do botão flutuante: a Central de Atendimento (chat). */
export const CHAT_FAB_HREF = "/recepcao/atendimento";

/** Telas do próprio chat: o botão ali seria redundante e cobriria o campo de envio. */
const CHAT_PREFIXES = ["/recepcao/atendimento", "/m/atendimento"] as const;

/**
 * O botão aparece só para quem está logado e consegue abrir a Central de
 * Atendimento (mesma regra do guard de rotas). Hoje: gestor, supervisão e
 * recepção. Terapeuta e Família não veem; faturamento também não, pois o
 * guard o redirecionaria para a home.
 */
export function shouldShowChatFab(role: string | null | undefined, pathname: string | null): boolean {
  if (!role || !(ROLES as readonly string[]).includes(role)) return false;
  if (!pathname) return false;
  if (CHAT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return isPathAllowedForRole(role as Role, CHAT_FAB_HREF);
}

/** Número do balão: acima de 99 vira "99+" para não estourar o círculo. */
export function formatBadgeCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}
