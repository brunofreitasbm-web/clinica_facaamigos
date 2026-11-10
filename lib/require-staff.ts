// lib/require-staff.ts
//
// Portão de papel para Server Actions que usam o client admin (service_role,
// sem RLS). O `proxy.ts` só filtra por caminho; uma Server Action pode ser
// invocada por POST direto, então cada action que ignora a RLS precisa
// conferir no servidor QUEM está chamando.
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";
import { isStaffProfile } from "@/lib/require-staff-pure";

export const STAFF_FORBIDDEN_ERROR = "Você não tem permissão para esta ação.";
export const STAFF_SESSION_ERROR = "Sessão expirada. Faça login de novo.";

export type StaffContext = { ok: true; userId: string; role: Role } | { ok: false; error: string };

/** Usuário da sessão + papel de equipe. `allowed` restringe a papéis específicos (gestor sempre passa). */
export async function requireStaff(allowed?: readonly Role[]): Promise<StaffContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: STAFF_SESSION_ERROR };

  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  const effective = allowed && allowed.length > 0 ? ([...allowed, "gestor"] as Role[]) : undefined;
  if (!isStaffProfile(profile, effective)) return { ok: false, error: STAFF_FORBIDDEN_ERROR };
  return { ok: true, userId: user.id, role: profile!.role as Role };
}
