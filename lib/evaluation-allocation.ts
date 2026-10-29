// lib/evaluation-allocation.ts
// Escolhe o avaliador da 1ª avaliação no agendamento manual da Supervisão. A
// regra (livre no horário + menos avaliações na semana) mora em
// lib/evaluation-offer-slots-pure.ts; aqui só carregamos os dados.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone, nextCalendarDay, previousCalendarDay, zonedDateTimeToUtc } from "@/lib/timezone";
import { timeToMinutes, weekdayOf } from "@/lib/clinic-calendar-pure";
import { pickEvaluatorForSlot, type BusyRange, type OfferTherapist } from "@/lib/evaluation-offer-slots-pure";

const CANCELLED = "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,remarcada)";

function minuteOfDay(instant: Date): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(instant)
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

/**
 * @returns id do avaliador, ou `null` quando nenhum avaliador ativo está livre
 *   naquele horário. Erro de leitura da agenda lança: não vira "todo mundo livre".
 */
export async function allocateEvaluator(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  clinicId: string,
  date: string,
  startMin: number,
  endMin: number,
): Promise<string | null> {
  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("is_evaluator", true)
    .eq("active", true);
  if (profilesErr) throw new Error(`Falha ao ler os avaliadores: ${profilesErr.message}`);
  const therapistIds = ((profiles ?? []) as { id: string }[]).map((p) => p.id);
  if (therapistIds.length === 0) return null;

  // Semana de segunda a domingo que contém `date` — base da contagem de carga.
  let weekStart = date;
  for (let i = (weekdayOf(date) + 6) % 7; i > 0; i--) weekStart = previousCalendarDay(weekStart);
  let weekEnd = weekStart;
  for (let i = 0; i < 7; i++) weekEnd = nextCalendarDay(weekEnd);
  const weekStartIso = zonedDateTimeToUtc(weekStart, "00:00", CLINIC_TIMEZONE).toISOString();
  const weekEndIso = zonedDateTimeToUtc(weekEnd, "00:00", CLINIC_TIMEZONE).toISOString();

  const [availabilityRes, weekRes] = await Promise.all([
    admin
      .from("professional_availability")
      .select("profile_id, day_of_week, start_time, end_time")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .in("profile_id", therapistIds),
    admin
      .from("appointments")
      .select("therapist_id, starts_at, ends_at, is_evaluation")
      .gte("starts_at", weekStartIso)
      .lt("starts_at", weekEndIso)
      .in("therapist_id", therapistIds)
      .not("status", "in", CANCELLED),
  ]);
  if (availabilityRes.error) throw new Error(`Falha ao ler a disponibilidade: ${availabilityRes.error.message}`);
  if (weekRes.error) throw new Error(`Falha ao ler a agenda: ${weekRes.error.message}`);

  const windowsByTherapist = new Map<string, Map<number, [number, number][]>>();
  for (const a of (availabilityRes.data ?? []) as { profile_id: string; day_of_week: number; start_time: string; end_time: string }[]) {
    const perDay = windowsByTherapist.get(a.profile_id) ?? new Map<number, [number, number][]>();
    perDay.set(a.day_of_week, [...(perDay.get(a.day_of_week) ?? []), [timeToMinutes(a.start_time), timeToMinutes(a.end_time)]]);
    windowsByTherapist.set(a.profile_id, perDay);
  }
  const therapists: OfferTherapist[] = therapistIds.map((id) => ({ id, windows: windowsByTherapist.get(id) ?? null }));

  const busy: BusyRange[] = [];
  const weekLoad = new Map<string, number>();
  for (const a of (weekRes.data ?? []) as { therapist_id: string; starts_at: string; ends_at: string; is_evaluation: boolean | null }[]) {
    const start = new Date(a.starts_at);
    busy.push({
      therapistId: a.therapist_id,
      roomId: null,
      startMs: start.getTime(),
      endMs: new Date(a.ends_at).getTime(),
      date: civilDateInTimeZone(start, CLINIC_TIMEZONE),
      startMin: minuteOfDay(start),
    });
    if (a.is_evaluation) weekLoad.set(a.therapist_id, (weekLoad.get(a.therapist_id) ?? 0) + 1);
  }

  const toMs = (min: number) => zonedDateTimeToUtc(date, `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, CLINIC_TIMEZONE).getTime();
  return pickEvaluatorForSlot({
    therapists,
    busy,
    weekLoad,
    dayOfWeek: weekdayOf(date),
    startMin,
    endMin,
    startMs: toMs(startMin),
    endMs: toMs(endMin),
  });
}
