// lib/clinic-calendar.ts
// Carrega do banco o que a regra pura (lib/clinic-calendar-pure.ts) precisa:
// grade de clinic_business_hours e fechamentos cadastrados num intervalo.
// Feriados nacionais não vêm do banco — são calculados em código.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEV_CLINIC_ID } from "@/lib/constants";
import {
  timeToMinutes,
  type BusinessHourRow,
  type ClinicClosure,
} from "@/lib/clinic-calendar-pure";

export type ClinicCalendarData = {
  businessHours: BusinessHourRow[];
  closures: ClinicClosure[];
};

/** Expediente que valia no código antes de clinic_business_hours virar a fonte única. */
const LEGACY_BUSINESS_HOURS: BusinessHourRow[] = [
  ...[1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "08:00:00", close_time: "19:00:00" })),
  { day_of_week: 6, open_time: "08:00:00", close_time: "12:00:00" },
];

/**
 * @param fromDate/toDate "YYYY-MM-DD", inclusivos.
 *
 * Grade vazia no banco cai no expediente antigo do código (seg–sex 08–19,
 * sáb 08–12) em vez de fechar a clínica inteira. Erro de leitura NÃO vira
 * "sem fechamentos" em silêncio: registra no log e segue só com feriados +
 * expediente — o trigger do banco continua sendo a barreira final.
 */
export async function loadClinicCalendar(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  fromDate: string,
  toDate: string,
  clinicId: string = DEV_CLINIC_ID,
): Promise<ClinicCalendarData> {
  const [hoursRes, closuresRes] = await Promise.all([
    supabase.from("clinic_business_hours").select("day_of_week, open_time, close_time").eq("clinic_id", clinicId),
    supabase
      .from("clinic_closures")
      .select("closure_date, start_time, end_time, reason")
      .eq("clinic_id", clinicId)
      .gte("closure_date", fromDate)
      .lte("closure_date", toDate),
  ]);

  if (hoursRes.error) console.error("[clinic-calendar] clinic_business_hours:", hoursRes.error.message);
  if (closuresRes.error) console.error("[clinic-calendar] clinic_closures:", closuresRes.error.message);

  const rows = (hoursRes.data ?? []) as BusinessHourRow[];
  const closures: ClinicClosure[] = (
    (closuresRes.data ?? []) as { closure_date: string; start_time: string | null; end_time: string | null; reason: string }[]
  ).map((c) => ({
    date: c.closure_date,
    start_minutes: c.start_time ? timeToMinutes(c.start_time) : null,
    end_minutes: c.end_time ? timeToMinutes(c.end_time) : null,
    reason: c.reason,
  }));

  return { businessHours: rows.length > 0 ? rows : LEGACY_BUSINESS_HOURS, closures };
}
