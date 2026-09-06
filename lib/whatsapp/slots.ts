// lib/whatsapp/slots.ts
/**
 * Generalização de `getAvailableSlots`
 * (app/recepcao/agenda/session-actions.ts): aquela função busca vagas pra
 * uma sala+terapeuta *específicos* de uma sessão já existente; esta busca
 * vagas pro supervisor avaliador configurado em `clinic_settings`, em
 * *qualquer* sala livre da clínica — não há sessão a excluir porque é uma
 * avaliação nova.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";

const WEEKDAY_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export type ClinicEvaluationSettings = {
  supervisorProfileId: string;
  durationMinutes: number;
  weekdays: number[]; // 0=domingo..6=sábado
  startHour: number;
  endHour: number;
};

export type EvaluationSlot = {
  id: string; // `slot:{roomId}:{startsAtIso}` — usado como ListId no list-picker
  roomId: string;
  startsAtIso: string;
  endsAtIso: string;
  dateLabel: string;
  timeLabel: string;
};

export async function getClinicEvaluationSettings(): Promise<ClinicEvaluationSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clinic_settings")
    .select(
      "evaluation_supervisor_profile_id, evaluation_duration_minutes, evaluation_weekdays, evaluation_start_hour, evaluation_end_hour",
    )
    .eq("clinic_id", DEV_CLINIC_ID)
    .maybeSingle();

  if (!data?.evaluation_supervisor_profile_id) return null;

  return {
    supervisorProfileId: data.evaluation_supervisor_profile_id,
    durationMinutes: data.evaluation_duration_minutes,
    weekdays: data.evaluation_weekdays,
    startHour: data.evaluation_start_hour,
    endHour: data.evaluation_end_hour,
  };
}

export async function getEvaluationSlots(
  settings: ClinicEvaluationSettings,
  opts: { days?: number; limit?: number } = {},
): Promise<EvaluationSlot[]> {
  const days = opts.days ?? 10;
  const limit = opts.limit ?? 9;
  const admin = createAdminClient();

  const { data: rooms } = await admin.from("rooms").select("id").eq("clinic_id", DEV_CLINIC_ID);
  const roomIds = (rooms ?? []).map((r) => r.id);
  if (roomIds.length === 0) return [];

  const dayList: string[] = [];
  let cursor = todayInTimeZone(CLINIC_TIMEZONE);
  for (let i = 0; i < days; i++) {
    dayList.push(cursor);
    cursor = nextCalendarDay(cursor);
  }

  const rangeStart = zonedDateTimeToUtc(dayList[0], "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(dayList[dayList.length - 1]), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: busy } = await admin
    .from("appointments")
    .select("starts_at, ends_at, room_id, therapist_id, status")
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .not("status", "in", "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,remarcada)")
    .or(`room_id.in.(${roomIds.join(",")}),therapist_id.eq.${settings.supervisorProfileId}`);

  const busyByRoom = new Map<string, { start: number; end: number }[]>();
  const busySupervisor: { start: number; end: number }[] = [];
  for (const b of busy ?? []) {
    const range = { start: new Date(b.starts_at).getTime(), end: new Date(b.ends_at).getTime() };
    if (b.therapist_id === settings.supervisorProfileId) busySupervisor.push(range);
    if (roomIds.includes(b.room_id)) {
      const list = busyByRoom.get(b.room_id) ?? [];
      list.push(range);
      busyByRoom.set(b.room_id, list);
    }
  }

  const overlaps = (ranges: { start: number; end: number }[], start: number, end: number) =>
    ranges.some((r) => start < r.end && end > r.start);

  const now = Date.now();
  const slots: EvaluationSlot[] = [];

  for (const day of dayList) {
    const [year, month, dayNum] = day.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, dayNum)).getUTCDay();
    if (!settings.weekdays.includes(weekday)) continue;

    for (let hour = settings.startHour; hour < settings.endHour && slots.length < limit; hour++) {
      for (const minute of [0, 30]) {
        if (slots.length >= limit) break;
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const startsAt = zonedDateTimeToUtc(day, timeStr, CLINIC_TIMEZONE);
        if (startsAt.getTime() <= now) continue;
        const endsAt = new Date(startsAt.getTime() + settings.durationMinutes * 60_000);

        if (overlaps(busySupervisor, startsAt.getTime(), endsAt.getTime())) continue;

        const freeRoomId = roomIds.find(
          (roomId) => !overlaps(busyByRoom.get(roomId) ?? [], startsAt.getTime(), endsAt.getTime()),
        );
        if (!freeRoomId) continue;

        slots.push({
          id: `slot:${freeRoomId}:${startsAt.toISOString()}`,
          roomId: freeRoomId,
          startsAtIso: startsAt.toISOString(),
          endsAtIso: endsAt.toISOString(),
          dateLabel: `${String(dayNum).padStart(2, "0")}/${String(month).padStart(2, "0")} (${WEEKDAY_PT[weekday]})`,
          timeLabel: timeStr,
        });
      }
    }
  }

  return slots;
}
