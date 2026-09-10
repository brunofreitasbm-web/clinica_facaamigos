// lib/aba-training-slots.ts
//
// Vagas de Treino ABA pra oferecer ao responsável no bot de WhatsApp
// (lib/twilio-intake-bot.ts). É o equivalente de lib/available-slots.ts pra
// esse tipo de atendimento — mas a lógica é outra: aqui não se procura
// buraco livre na agenda de sala+terapeuta, e sim VAGA numa turma já
// aberta, que tem sala, dia da semana e horário fixos (8/10/14/16h) e um
// bloco de 2h. O que limita é a capacidade da sala, não a sobreposição:
// sessão de turma é `modality='grupo'`, isenta das exclusion constraints de
// `appointments`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, nextCalendarDay, zonedDateTimeToUtc } from "@/lib/timezone";
import { WEEKDAY_LABELS, toHourMinute } from "@/lib/aba-training";

export type AbaTrainingSlot = {
  classId: string;
  roomId: string;
  roomName: string;
  /** `"14/09 (Segunda-feira) às 08:00"` — já pronto pra lista do WhatsApp. */
  label: string;
  startsAtIso: string;
  endsAtIso: string;
  /** Vagas ainda livres na turma naquele dia, depois de descontar os agendados. */
  seatsLeft: number;
};

export type ComputeAbaTrainingSlotsOptions = {
  clinicId: string;
  /** Duração do bloco, em minutos (vem de `appointment_types.duration_minutes`). */
  durationMinutes: number;
  /** Quantos dias corridos a partir de hoje são varridos. Default 21. */
  daysAhead?: number;
  /** Teto de vagas devolvidas no total. Default 3 — mesma dose da oferta de avaliação. */
  limit?: number;
  /** Teto por dia civil, pra não oferecer só um dia da semana. */
  maxPerDay?: number;
};

/**
 * Vagas reais nas turmas ativas da clínica, da mais próxima pra mais
 * distante. Uma turma entra na lista enquanto tiver assento sobrando —
 * quem garante que ninguém passe da capacidade na hora da reserva é o
 * trigger `appointments_aba_training_guard`; esta função só evita oferecer
 * o que já se sabe cheio.
 */
export async function computeAbaTrainingSlots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  opts: ComputeAbaTrainingSlotsOptions,
): Promise<AbaTrainingSlot[]> {
  const { clinicId, durationMinutes, daysAhead = 21, limit = 3, maxPerDay } = opts;

  const { data: classes } = await supabase
    .from("aba_training_classes")
    .select("id, room_id, day_of_week, start_time, rooms(name, capacity)")
    .eq("clinic_id", clinicId)
    .eq("active", true);

  if (!classes || classes.length === 0) return [];

  const days: string[] = [];
  let cursor = todayInTimeZone(CLINIC_TIMEZONE);
  for (let i = 0; i < daysAhead; i++) {
    days.push(cursor);
    cursor = nextCalendarDay(cursor);
  }

  const rangeStart = zonedDateTimeToUtc(days[0], "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(days[days.length - 1]), "00:00", CLINIC_TIMEZONE).toISOString();

  // Ocupação já agendada de todas as turmas no período, numa leitura só.
  const { data: booked } = await supabase
    .from("appointments")
    .select("aba_class_id, starts_at")
    .not("aba_class_id", "is", null)
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .not("status", "in", "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,remarcada)");

  const occupancy = new Map<string, number>();
  for (const row of (booked ?? []) as { aba_class_id: string; starts_at: string }[]) {
    const key = `${row.aba_class_id}|${new Date(row.starts_at).getTime()}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  }

  const now = Date.now();
  const slots: AbaTrainingSlot[] = [];

  for (const day of days) {
    if (slots.length >= limit) break;
    const [year, month, dayNum] = day.split("-").map(Number);
    const dow = new Date(Date.UTC(year, month - 1, dayNum)).getUTCDay();
    let countThisDay = 0;

    for (const cls of classes as {
      id: string;
      room_id: string;
      day_of_week: number;
      start_time: string;
      rooms: { name: string; capacity: number } | { name: string; capacity: number }[] | null;
    }[]) {
      if (slots.length >= limit) break;
      if (maxPerDay && countThisDay >= maxPerDay) break;
      if (cls.day_of_week !== dow) continue;

      const time = toHourMinute(cls.start_time);
      const startsAt = zonedDateTimeToUtc(day, time, CLINIC_TIMEZONE);
      if (startsAt.getTime() <= now) continue;

      const room = Array.isArray(cls.rooms) ? cls.rooms[0] : cls.rooms;
      const capacity = room?.capacity ?? 0;
      const taken = occupancy.get(`${cls.id}|${startsAt.getTime()}`) ?? 0;
      const seatsLeft = capacity - taken;
      if (seatsLeft <= 0) continue;

      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      slots.push({
        classId: cls.id,
        roomId: cls.room_id,
        roomName: room?.name ?? "Sala",
        label: `${String(dayNum).padStart(2, "0")}/${String(month).padStart(2, "0")} (${WEEKDAY_LABELS[dow]}) às ${time}`,
        startsAtIso: startsAt.toISOString(),
        endsAtIso: endsAt.toISOString(),
        seatsLeft,
      });
      countThisDay++;
    }
  }

  return slots;
}
