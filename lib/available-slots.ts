// lib/available-slots.ts
// Cálculo puro de horários livres (sala+terapeuta), extraído de
// app/recepcao/agenda/session-actions.ts:getAvailableSlots para ser
// reaproveitado pelo bot de acolhimento de plano de saúde
// (lib/twilio-intake-bot.ts), que precisa da mesma lógica mas com duração e
// limite de slots diferentes (avaliação = 50min, até 5 opções, no máximo 2
// por dia — pra não lotar a lista no WhatsApp). getAvailableSlots continua
// existindo com a mesma assinatura, só que agora delega pra cá.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, nextCalendarDay, zonedDateTimeToUtc } from "@/lib/timezone";

const WEEKDAY_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export type AvailableSlot = {
  dateLabel: string;
  timeLabel: string;
  startsAtIso: string;
  endsAtIso: string;
};

export type ComputeAvailableSlotsOptions = {
  roomId: string;
  therapistId: string;
  durationMinutes: number;
  /** Exclui o próprio agendamento (reagendamento) do cálculo de conflito. */
  excludeAppointmentId?: string;
  /** Quantos dias corridos a partir de hoje são varridos. Default 5. */
  daysAhead?: number;
  /** Teto de slots devolvidos no total. Default 8. */
  limit?: number;
  /** Teto de slots por dia civil (evita lotar a lista com um único dia). */
  maxPerDay?: number;
};

/**
 * Vagas livres reais pra sala+terapeuta informados, em horário comercial
 * (08h–19h, passo de 30min), respeitando `limit`/`maxPerDay`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeAvailableSlots(supabase: SupabaseClient<any>, opts: ComputeAvailableSlotsOptions): Promise<AvailableSlot[]> {
  const { roomId, therapistId, durationMinutes, excludeAppointmentId, daysAhead = 5, limit = 8, maxPerDay } = opts;

  const days: string[] = [];
  let cursor = todayInTimeZone(CLINIC_TIMEZONE);
  for (let i = 0; i < daysAhead; i++) {
    days.push(cursor);
    cursor = nextCalendarDay(cursor);
  }

  const rangeStart = zonedDateTimeToUtc(days[0], "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(days[days.length - 1]), "00:00", CLINIC_TIMEZONE).toISOString();

  let query = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, room_id, therapist_id, status")
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .not("status", "in", "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,falta_familia)")
    .or(`room_id.eq.${roomId},therapist_id.eq.${therapistId}`);
  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data: busy } = await query;

  const busyRanges = (busy ?? []).map((b: { starts_at: string; ends_at: string }) => ({
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  const now = Date.now();
  const slots: AvailableSlot[] = [];

  for (const day of days) {
    let countThisDay = 0;
    for (let hour = 8; hour < 19 && slots.length < limit; hour++) {
      for (const minute of [0, 30]) {
        if (slots.length >= limit) break;
        if (maxPerDay && countThisDay >= maxPerDay) break;
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const startsAt = zonedDateTimeToUtc(day, timeStr, CLINIC_TIMEZONE);
        if (startsAt.getTime() <= now) continue;
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
        const overlaps = busyRanges.some((r) => startsAt.getTime() < r.end && endsAt.getTime() > r.start);
        if (overlaps) continue;

        const [year, month, dayNum] = day.split("-").map(Number);
        const weekday = WEEKDAY_PT[new Date(Date.UTC(year, month - 1, dayNum)).getUTCDay()];
        slots.push({
          dateLabel: `${String(dayNum).padStart(2, "0")}/${String(month).padStart(2, "0")} (${weekday})`,
          timeLabel: timeStr,
          startsAtIso: startsAt.toISOString(),
          endsAtIso: endsAt.toISOString(),
        });
        countThisDay++;
      }
    }
  }

  return slots;
}
