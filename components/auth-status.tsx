import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("demo_user_role")?.value;
  const demoEmail = cookieStore.get("demo_user_email")?.value;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !demoRole) return null;

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const currentRole = profile?.role ?? demoRole ?? "gestor";
  const userDisplayName = profile?.full_name ?? demoEmail ?? user?.email ?? "Modo Demo";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line-strong bg-slate-900 px-6 py-2 text-xs text-slate-200 sm:px-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-amber-400">Alternar Visão Demo:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {MODULE_LINKS.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`rounded px-2 py-1 font-medium transition-colors no-underline ${
                currentRole === mod.role
                  ? "bg-amber-400 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {mod.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span>
          <strong className="text-white">{userDisplayName}</strong>
          {currentRole && (
            <span className="ml-1 text-slate-400">
              ({ROLE_LABEL[currentRole as Role] ?? currentRole})
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
