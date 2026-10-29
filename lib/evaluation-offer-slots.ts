// lib/evaluation-offer-slots.ts
// Monta, a partir do banco, os horários que o bot oferece ao responsável para
// a 1ª avaliação. A regra (preenchimento de turno, avaliadoras, feriados) mora
// em lib/evaluation-offer-slots-pure.ts; aqui só carregamos os dados e
// formatamos os rótulos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone, nextCalendarDay, todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { loadClinicCalendar } from "@/lib/clinic-calendar";
import { minutesToHHMM, timeToMinutes, weekdayOf } from "@/lib/clinic-calendar-pure";
import {
  buildOccupancy,
  generateEvaluationCandidates,
  pickOfferPage,
  type BusyRange,
  type OfferTherapist,
} from "@/lib/evaluation-offer-slots-pure";

/** Quantos dias à frente o bot enxerga. */
const HORIZON_DAYS = 21;

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type EvaluationOfferSlot = {
  index: number;
  /** Cabe no título de item de lista do WhatsApp (até 24 caracteres). */
  label: string;
  starts_at: string;
  ends_at: string;
  therapist_id: string;
  room_id: string;
};

/** Minuto-do-dia de um instante, no fuso da clínica. */
function minuteOfDayInClinic(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function formatOfferSlotLabel(date: string, startMin: number): string {
  return `${WEEKDAY_SHORT[weekdayOf(date)]} ${date.slice(8)}/${date.slice(5, 7)} às ${minutesToHHMM(startMin)}`;
}

/**
 * @param page 0 = os 3 primeiros horários na ordem de preenchimento de turno;
 *   1 = "Nenhum serve" → os 3 seguintes; e assim por diante.
 */
export async function computeEvaluationOfferSlots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  clinicId: string,
  opts: { page?: number; nowMs?: number; therapistId?: string; roomId?: string } = {},
): Promise<EvaluationOfferSlot[]> {
  const page = opts.page ?? 0;
  const nowMs = opts.nowMs ?? Date.now();

  // Data mais próxima possível: o 1º dia sugerido é AMANHÃ (nunca hoje).
  const earliestDate = nextCalendarDay(todayInTimeZone(CLINIC_TIMEZONE));
  const days: string[] = [];
  let cursor = earliestDate;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    days.push(cursor);
    cursor = nextCalendarDay(cursor);
  }

  const [therapistsRes, roomsRes] = await Promise.all([
    admin.from("profiles").select("id").eq("clinic_id", clinicId).eq("is_evaluator", true).eq("active", true),
    admin.from("rooms").select("id").eq("clinic_id", clinicId).eq("is_evaluation_room", true),
  ]);
  // `therapistId`/`roomId` restringem a busca a um avaliador/sala (sugestão no agendamento manual).
  const therapistIds = ((therapistsRes.data ?? []) as { id: string }[]).map((t) => t.id).filter((id) => !opts.therapistId || id === opts.therapistId);
  const roomIds = ((roomsRes.data ?? []) as { id: string }[]).map((r) => r.id).filter((id) => !opts.roomId || id === opts.roomId);
  if (therapistIds.length === 0 || roomIds.length === 0) return [];

  const rangeStart = zonedDateTimeToUtc(days[0], "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(days[days.length - 1]), "00:00", CLINIC_TIMEZONE).toISOString();

  const [availabilityRes, busyRes, calendar] = await Promise.all([
    admin
      .from("professional_availability")
      .select("profile_id, day_of_week, start_time, end_time")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .in("profile_id", therapistIds),
    admin
      .from("appointments")
      .select("therapist_id, room_id, starts_at, ends_at")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd)
      .not("status", "in", "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,remarcada)")
      .or(`therapist_id.in.(${therapistIds.join(",")}),room_id.in.(${roomIds.join(",")})`),
    loadClinicCalendar(admin, days[0], days[days.length - 1], clinicId),
  ]);

  // Sem leitura da agenda não dá pra garantir que o horário está livre: erro
  // aqui NÃO vira "agenda vazia" (ofereceria horário ocupado).
  if (busyRes.error) throw new Error(`Falha ao ler a agenda: ${busyRes.error.message}`);

  const windowsByTherapist = new Map<string, Map<number, [number, number][]>>();
  for (const a of (availabilityRes.data ?? []) as { profile_id: string; day_of_week: number; start_time: string; end_time: string }[]) {
    const perDay = windowsByTherapist.get(a.profile_id) ?? new Map<number, [number, number][]>();
    const list = perDay.get(a.day_of_week) ?? [];
    list.push([timeToMinutes(a.start_time), timeToMinutes(a.end_time)]);
    perDay.set(a.day_of_week, list);
    windowsByTherapist.set(a.profile_id, perDay);
  }
  const therapists: OfferTherapist[] = therapistIds.map((id) => ({ id, windows: windowsByTherapist.get(id) ?? null }));

  const busy: BusyRange[] = ((busyRes.data ?? []) as { therapist_id: string; room_id: string | null; starts_at: string; ends_at: string }[]).map((b) => {
    const start = new Date(b.starts_at);
    return {
      therapistId: b.therapist_id,
      roomId: b.room_id,
      startMs: start.getTime(),
      endMs: new Date(b.ends_at).getTime(),
      date: civilDateInTimeZone(start, CLINIC_TIMEZONE),
      startMin: minuteOfDayInClinic(start),
    };
  });

  const candidates = generateEvaluationCandidates({
    days,
    therapists,
    roomIds,
    busy,
    businessHours: calendar.businessHours,
    closures: calendar.closures,
    nowMs,
    earliestDate,
    toUtcMs: (date, minutes) => zonedDateTimeToUtc(date, minutesToHHMM(minutes), CLINIC_TIMEZONE).getTime(),
  });

  return pickOfferPage(candidates, buildOccupancy(busy), page).map((c, i) => ({
    index: i + 1,
    label: formatOfferSlotLabel(c.date, c.startMin),
    starts_at: c.startsAtIso,
    ends_at: c.endsAtIso,
    therapist_id: c.therapistId,
    room_id: c.roomId,
  }));
}
