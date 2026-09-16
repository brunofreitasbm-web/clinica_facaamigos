import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/roles";

/**
 * Camada de acesso a sessão/perfil cacheada por request (React cache()).
 * Existe para colapsar as ~138 chamadas de `auth.getUser()` espalhadas pelo
 * repo (algumas telas fazem até 12 na mesma ação) em UMA chamada real por
 * request — cada uma é um round-trip de rede à API de Auth do Supabase.
 *
 * `cache()` não atravessa requests: continua havendo exatamente um
 * `getUser()` de verdade por request, então não há regressão de segurança.
 * Nunca trocar por `getSession()` — ele confia no cookie sem validar contra
 * o servidor de Auth.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export type ViewerProfile = {
  userId: string;
  role: Role | null;
  fullName: string;
  mustChangePassword: boolean;
  isAtProfessional: boolean;
  isEvaluator: boolean;
  active: boolean;
};

/**
 * Colunas cobrem os usos mais comuns de guard/redirect (role,
 * must_change_password) e das duas flags de perfil mais checadas fora do
 * guard (is_at_professional, is_evaluator). Telas que precisam de colunas
 * mais específicas (council_type, specialty_id, photo_url…) continuam
 * fazendo seu próprio `.from("profiles").select(...)` — este helper não
 * tenta ser o único ponto de leitura de `profiles`, só elimina a
 * duplicação do caminho comum de auth/role.
 */
export const getViewerProfile = cache(async (): Promise<ViewerProfile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, must_change_password, is_at_professional, is_evaluator, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    userId: user.id,
    role: (data.role as Role) ?? null,
    fullName: data.full_name,
    mustChangePassword: data.must_change_password,
    isAtProfessional: data.is_at_professional,
    isEvaluator: data.is_evaluator,
    active: data.active,
  };
});

/**
 * Redireciona para /login se não houver sessão, e para a home do papel se
 * `roles` for passado e o papel do usuário não estiver na lista.
 */
export const requireViewer = cache(async (roles?: Role[]): Promise<ViewerProfile> => {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  if (roles && roles.length > 0 && (!profile.role || !roles.includes(profile.role))) {
    redirect(profile.role ? ROLE_HOME[profile.role] : "/login");
  }
  return profile;
});
