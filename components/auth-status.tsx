import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { signOut } from "@/app/login/actions";

const MODULE_LINKS = [
  { label: "🏢 Gestor", href: "/gestor", role: "gestor" },
  { label: "📋 Recepção", href: "/recepcao", role: "recepcao" },
  { label: "🩺 Terapeuta", href: "/terapeuta", role: "terapeuta" },
  { label: "🔍 Supervisão", href: "/supervisao", role: "supervisor" },
  { label: "💰 Faturamento", href: "/faturamento", role: "faturamento" },
  { label: "👨‍👩‍👧 Família", href: "/familia", role: "responsavel" },
] as const;

export async function AuthStatus() {
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line-strong bg-slate-900 px-6 py-2 text-xs text-slate-200 sm:px-10">
      {currentRole === "gestor" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {MODULE_LINKS.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="rounded px-2 py-1 font-medium text-slate-300 no-underline transition-colors hover:bg-slate-700 hover:text-white"
            >
              {mod.label}
            </Link>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-4">
        <span>
          <strong className="text-white">{userDisplayName}</strong>
          {currentRole && (
            <span className="ml-1 text-slate-400">
              ({ROLE_LABEL[currentRole] ?? currentRole})
            </span>
          )}
        </span>
        <form action={signOut}>
          <button type="submit" className="rounded bg-rose-900/60 px-2 py-1 text-rose-200 hover:bg-rose-800 hover:text-white">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
