import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { getReceptionQueue } from "@/lib/reception-queue";
import { RecepcaoNav } from "@/components/recepcao-nav";
import { KnowledgeBaseDrawer } from "@/components/knowledge-base-drawer";

export const dynamic = "force-dynamic";

/**
 * Layout do módulo Recepção — monta o cabeçalho (RecepcaoNav) em toda tela
 * do módulo. Cada página sob app/recepcao só entrega o conteúdo daquela tela.
 */
export default async function RecepcaoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const today = todayInTimeZone(CLINIC_TIMEZONE);

  const [queue, { count: chegadasCount }] = await Promise.all([
    getReceptionQueue(supabase, DEV_CLINIC_ID),
    // Chegadas declaradas pelo QR ainda não confirmadas (nem descartadas/
    // expiradas) — badge visível em toda a /recepcao, não só na página
    // dedicada, porque não dá para assumir que alguém está com ela aberta.
    supabase
      .from("checkin_requests")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("service_date", today)
      .eq("status", "aguardando"),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RecepcaoNav pendingCount={queue.length} chegadasCount={chegadasCount ?? 0} />
      {children}
      <KnowledgeBaseDrawer />
    </div>
  );
}

