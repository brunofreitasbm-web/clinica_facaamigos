import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { signOut } from "@/app/login/actions";
import { isNextError } from "@/lib/next-utils";
import { RoleSwitcherMenu } from "@/components/role-switcher-menu";

const MODULE_LINKS = [
  { label: "🏢 Gestor", href: "/gestor", role: "gestor" },
  { label: "📋 Recepção", href: "/recepcao", role: "recepcao" },
  { label: "🩺 Terapeuta", href: "/terapeuta", role: "terapeuta" },
  { label: "🔍 Supervisão", href: "/supervisao", role: "supervisor" },
  { label: "💰 Faturamento", href: "/faturamento", role: "faturamento" },
  { label: "👨‍👩‍👧 Família", href: "/familia", role: "responsavel" },
] as const;

export async function AuthStatus() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    const currentRole = profile?.role as Role | undefined;
    const userDisplayName = profile?.full_name ?? user.email ?? "Usuário";

    return (
      <div className="flex items-center justify-end gap-4 border-b border-paper-line-strong bg-slate-900 px-6 py-2 text-xs text-slate-200 sm:px-10">
        {currentRole === "gestor" && <RoleSwitcherMenu links={MODULE_LINKS} />}

        <span className="flex items-center gap-1.5">
          <strong className="text-white">{userDisplayName}</strong>
          {currentRole && (
            <span
              className={
                currentRole === "gestor"
                  ? "inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-slate-900"
                  : "inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-slate-300"
              }
            >
              {currentRole === "gestor" ? "⚡ Modo Deus (Gestor)" : (ROLE_LABEL[currentRole] ?? currentRole)}
            </span>
          )}
        </span>
        <form action={signOut}>
          <button type="submit" className="rounded bg-rose-900/60 px-2 py-1 text-rose-200 hover:bg-rose-800 hover:text-white">
            Sair
          </button>
        </form>
      </div>
    );
  } catch (error) {
    if (isNextError(error)) throw error;
    console.error("Erro ao carregar AuthStatus no servidor:", error);
    return null;
  }
}
