import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { AtNav } from "@/components/at-nav";

/**
 * Layout do módulo Acompanhamento Terapêutico (AT). Não existe papel "at" —
 * quem entra é `terapeuta`/`supervisor`/`gestor` (ver
 * lib/roles.ts:ROLE_ALLOWED_PREFIXES); um `terapeuta` sem
 * `profiles.is_at_professional` é redirecionado aqui, não pelo middleware
 * (a flag é por perfil, não por prefixo de rota).
 */
export default async function AtLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_at_professional")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as Role | undefined;
  const canOpenAt =
    role === "gestor" || role === "supervisor" || (role === "terapeuta" && !!profile?.is_at_professional);

  if (!canOpenAt) {
    redirect(role ? ROLE_HOME[role] : "/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AtNav />
      {children}
    </div>
  );
}
