import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNextError } from "@/lib/next-utils";

/** Dados do operador logado exibidos no menu do usuário da barra dos módulos. */
export type CurrentUserMenu = {
  name: string;
  email: string | null;
  /** Signed URL do avatar (bucket privado profile-avatars); null = usa as iniciais. */
  avatarUrl: string | null;
  /** Papel do perfil (profiles.role); null se ausente. Usado p/ decidir o que a UI global exibe. */
  role: string | null;
};

const AVATAR_TTL_SECONDS = 60 * 60;

/**
 * Carregado no root layout (server) e entregue por contexto à barra do módulo.
 * Nunca lança: sem sessão, ou em falha de leitura, devolve null e a barra
 * simplesmente não mostra o menu — o restante da página segue normal.
 */
export async function loadCurrentUserMenu(): Promise<CurrentUserMenu | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_storage_path, role")
      .eq("id", user.id)
      .maybeSingle();

    let avatarUrl: string | null = null;
    if (profile?.avatar_storage_path) {
      const admin = createAdminClient();
      const { data: signed } = await admin.storage
        .from("profile-avatars")
        .createSignedUrl(profile.avatar_storage_path, AVATAR_TTL_SECONDS);
      avatarUrl = signed?.signedUrl ?? null;
    }

    return {
      name: profile?.full_name || user.email || "Usuário",
      email: user.email ?? null,
      avatarUrl,
      role: (profile?.role as string | null | undefined) ?? null,
    };
  } catch (error) {
    if (isNextError(error)) throw error;
    console.error("Erro ao carregar o usuário do menu:", error);
    return null;
  }
}
