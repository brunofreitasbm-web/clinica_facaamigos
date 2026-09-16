import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { getCachedReceptionQueue } from "@/lib/reception-queue";
import { RecepcaoNav } from "@/components/recepcao-nav";

/**
 * Server Component isolado num <Suspense> em app/recepcao/layout.tsx —
 * carrega os badges (fila de pendências + chegadas não confirmadas) sem
 * bloquear a pintura do menu/nav em si. Antes esse `await` vivia direto no
 * corpo do layout (que é `async`), e como um layout NÃO é coberto pelo
 * `loading.tsx` do segmento abaixo dele, toda navegação em /recepcao/*
 * ficava com a tela travada até as ~17 queries da fila resolverem. Ver
 * app/gestor/layout.tsx e app/terapeuta/layout.tsx, que já seguem este
 * padrão.
 */
export async function RecepcaoNavBadges() {
  const supabase = await createClient();
  const today = todayInTimeZone(CLINIC_TIMEZONE);

  const [queue, { count: chegadasCount }] = await Promise.all([
    getCachedReceptionQueue(DEV_CLINIC_ID),
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

  return <RecepcaoNav pendingCount={queue.length} chegadasCount={chegadasCount ?? 0} />;
}
