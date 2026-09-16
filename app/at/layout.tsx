import { redirect } from "next/navigation";
import { getViewerProfile } from "@/lib/auth/viewer";
import { ROLE_HOME } from "@/lib/roles";
import { AtNav } from "@/components/at-nav";

/**
 * Layout do módulo Acompanhamento Terapêutico (AT). Não existe papel "at" —
 * quem entra é `terapeuta`/`supervisor`/`gestor` (ver
 * lib/roles.ts:ROLE_ALLOWED_PREFIXES); um `terapeuta` sem
 * `profiles.is_at_professional` é redirecionado aqui, não pelo middleware
 * (a flag é por perfil, não por prefixo de rota).
 *
 * Usa getViewerProfile() (lib/auth/viewer.ts, cache() por request) em vez de
 * ler `auth.getUser()` + `profiles` direto: app/at/page.tsx faz exatamente a
 * mesma checagem de papel no mesmo render, e antes isso duplicava as duas
 * queries.
 */
export default async function AtLayout({ children }: { children: React.ReactNode }) {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");

  const { role, isAtProfessional } = profile;
  const canOpenAt =
    role === "gestor" || role === "supervisor" || (role === "terapeuta" && isAtProfessional);

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
