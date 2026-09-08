import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { nextCalendarDay, todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { getReceptionQueue } from "@/lib/reception-queue";
import { RecepcaoNav } from "@/components/recepcao-nav";

export const dynamic = "force-dynamic";

/**
 * Layout do módulo Recepção — monta o cabeçalho (RecepcaoNav) em toda tela
 * do módulo. Cada página (app/recepcao/**\/page.tsx) só entrega o conteúdo
 * daquela tela.
 */
export default async function RecepcaoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const tomorrow = nextCalendarDay(today);
  const rangeStart = zonedDateTimeToUtc(tomorrow, "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(tomorrow), "00:00", CLINIC_TIMEZONE).toISOString();

  const [queue, { data: tomorrowAppointments }, { count: chegadasCount }] = await Promise.all([
    getReceptionQueue(supabase, DEV_CLINIC_ID),
    supabase
      .from("appointments")
      .select("id, confirmed_at")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd)
      .in("status", ["agendada", "confirmada"])
      .eq("is_provisional", false),
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

  const tomorrowUnconfirmedCount = (tomorrowAppointments ?? []).filter((a) => !a.confirmed_at).length;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <RecepcaoNav
        pendingCount={queue.length}
        tomorrowUnconfirmedCount={tomorrowUnconfirmedCount}
        chegadasCount={chegadasCount ?? 0}
      />
      {children}
    </div>
  );
}
