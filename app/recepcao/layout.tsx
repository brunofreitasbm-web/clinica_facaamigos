import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { nextCalendarDay, todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { getReceptionQueue } from "@/lib/reception-queue";
import { RecepcaoNav } from "@/components/recepcao-nav";
import type { PalettePatient } from "@/components/recepcao-command-palette";

export const dynamic = "force-dynamic";

/**
 * Layout do módulo Recepção — monta o cabeçalho + barra de atalhos
 * (RecepcaoNav) em toda tela do módulo, pra que "nova sessão", "novo
 * paciente", "confirmar amanhã", "pendências" e a busca de paciente fiquem
 * sempre à mão, sem precisar voltar pra home ou abrir submenu. Cada página
 * (app/recepcao/**\/page.tsx) só entrega o conteúdo daquela tela.
 */
export default async function RecepcaoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const tomorrow = nextCalendarDay(today);
  const rangeStart = zonedDateTimeToUtc(tomorrow, "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(tomorrow), "00:00", CLINIC_TIMEZONE).toISOString();

  const [queue, { data: tomorrowAppointments }, { data: patientRows }] = await Promise.all([
    getReceptionQueue(supabase, DEV_CLINIC_ID),
    supabase
      .from("appointments")
      .select("id, confirmed_at")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd)
      .in("status", ["agendada", "confirmada"])
      .eq("is_provisional", false),
    supabase.from("patients").select("id, full_name").eq("clinic_id", DEV_CLINIC_ID).order("full_name"),
  ]);

  const tomorrowUnconfirmedCount = (tomorrowAppointments ?? []).filter((a) => !a.confirmed_at).length;

  const patientIds = (patientRows ?? []).map((p) => p.id);
  const { data: guardianRows } = patientIds.length
    ? await supabase
        .from("guardians")
        .select("patient_id, full_name, phone, is_financial")
        .in("patient_id", patientIds)
    : { data: [] as { patient_id: string; full_name: string; phone: string; is_financial: boolean }[] };

  const guardianByPatient = new Map<string, { full_name: string; phone: string }>();
  for (const g of guardianRows ?? []) {
    const existing = guardianByPatient.get(g.patient_id);
    if (!existing || g.is_financial) guardianByPatient.set(g.patient_id, { full_name: g.full_name, phone: g.phone });
  }

  const patients: PalettePatient[] = (patientRows ?? []).map((p) => {
    const guardian = guardianByPatient.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      guardianName: guardian?.full_name ?? null,
      guardianPhone: guardian?.phone ?? null,
    };
  });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <RecepcaoNav pendingCount={queue.length} tomorrowUnconfirmedCount={tomorrowUnconfirmedCount} patients={patients} />
      {children}
    </div>
  );
}
