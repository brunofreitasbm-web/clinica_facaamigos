// lib/require-staff-pure.ts
//
// Regra pura do portão de papel (sem dependência de Next/Supabase, testável
// com `node --test`). O lado servidor fica em lib/require-staff.ts.
import type { Role } from "./roles.ts";

/**
 * Equipe = qualquer papel conhecido que não seja a família. Sem perfil ou
 * perfil inativo = negado. `allowed` restringe a papéis específicos.
 */
export function isStaffProfile(
  profile: { role?: string | null; active?: boolean | null } | null | undefined,
  allowed?: readonly Role[],
): boolean {
  if (!profile?.role || profile.role === "responsavel") return false;
  if (profile.active === false) return false;
  if (allowed && allowed.length > 0 && !allowed.includes(profile.role as Role)) return false;
  return true;
}
