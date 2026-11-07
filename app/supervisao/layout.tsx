import { SupervisaoTabProvider } from "./supervisao-tab-context";
import { SupervisaoHeader } from "@/components/supervisao-header";
import { BonusFloatingWidget } from "@/components/bonus-floating-widget";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout do módulo Coordenação — monta o cabeçalho (SupervisaoHeader) em
 * toda tela do módulo.
 *
 * O nome exibido no menu pessoal vem do perfil de quem está logado (antes era
 * um texto fixo com o nome do gestor, que aparecia para todos os operadores).
 */
export default async function SupervisaoLayout({ children }: { children: React.ReactNode }) {
  let userName: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      userName = profile?.full_name?.trim() || user.email || null;
    }
  } catch {
    // Sem nome o cabeçalho cai no rótulo genérico; nunca derruba o módulo.
    userName = null;
  }

  return (
    <SupervisaoTabProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <SupervisaoHeader userName={userName} />
        {children}
        <BonusFloatingWidget />
      </div>
    </SupervisaoTabProvider>
  );
}
