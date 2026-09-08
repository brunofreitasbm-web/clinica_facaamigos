"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";
import {
  getEvaluationCalendarAppointments,
  getEvaluationPool,
  type EvaluationBookInput,
  type EvaluationCalendarAppointment,
  type EvaluationPoolItem,
} from "@/lib/evaluation-agenda";
import { scheduleEvaluation } from "@/app/recepcao/pacientes/[id]/stage-actions";
import { rescheduleAppointmentAction } from "@/app/recepcao/agenda/session-actions";

type ActionResult = { success: true } | { success: false; error: string };

/** Duração fixa de toda 1ª avaliação/anamnese — mesma convenção usada em scheduleEvaluation e nos bots de WhatsApp. */
const EVALUATION_DURATION_MINUTES = 50;

export async function getEvaluationCalendarWeekAction(
  weekStartDateStr: string,
): Promise<{ success: true; appointments: EvaluationCalendarAppointment[] } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const weekStartIso = zonedDateTimeToUtc(weekStartDateStr, "00:00", CLINIC_TIMEZONE).toISOString();
    // Semana de agendamento vai de Segunda a Sábado (horário comercial inclui
    // sábado de manhã) — fim exclusivo é o Domingo, Segunda + 6 dias.
    let weekEndDateStr = weekStartDateStr;
    for (let i = 0; i < 6; i++) weekEndDateStr = nextCalendarDay(weekEndDateStr);
    const weekEndIso = zonedDateTimeToUtc(weekEndDateStr, "00:00", CLINIC_TIMEZONE).toISOString();
    const appointments = await getEvaluationCalendarAppointments(supabase, weekStartIso, weekEndIso);
    return { success: true, appointments };
  } catch {
    return { success: false, error: "Não foi possível carregar a semana." };
  }
}

export async function getEvaluationPoolAction(): Promise<{ success: true; pool: EvaluationPoolItem[] } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const pool = await getEvaluationPool(supabase, DEV_CLINIC_ID);
    return { success: true, pool };
  } catch {
    return { success: false, error: "Não foi possível carregar a fila de agendamento." };
  }
}

export async function scheduleFromPoolAction(
  bookInput: EvaluationBookInput,
  therapistId: string,
  roomId: string,
  date: string,
  time: string,
): Promise<ActionResult> {
  if (!therapistId || !roomId || !date || !time) {
    return { success: false, error: "Selecione terapeuta e sala antes de agendar." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + EVALUATION_DURATION_MINUTES * 60_000);

  if (bookInput.origin === "presencial") {
    const formData = new FormData();
    formData.set("therapist_id", therapistId);
    formData.set("room_id", roomId);
    formData.set("date", date);
    formData.set("time", time);
    return scheduleEvaluation(bookInput.patientId, formData);
  }

  const admin = createAdminClient();
  const rpcName = bookInput.origin === "whatsapp_anamnese" ? "book_anamnesis_slot_atomic" : "book_intake_lead_slot_atomic";
  const rpcArgs =
    bookInput.origin === "whatsapp_anamnese"
      ? {
          p_request_id: bookInput.requestId,
          p_therapist_id: therapistId,
          p_room_id: roomId,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        }
      : {
          p_lead_id: bookInput.leadId,
          p_therapist_id: therapistId,
          p_room_id: roomId,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc(rpcName, rpcArgs);

  if (error) {
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }
  if (!data?.success) {
    return { success: false, error: data?.error ?? "Não foi possível agendar." };
  }

  return { success: true };
}

export async function rescheduleEvaluationAction(appointmentId: string, date: string, time: string, durationMinutes: number): Promise<ActionResult> {
  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return rescheduleAppointmentAction(appointmentId, startsAt.toISOString(), endsAt.toISOString());
}
