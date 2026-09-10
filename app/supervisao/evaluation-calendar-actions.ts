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
import { sendEvaluationConfirmationNotification } from "@/lib/evaluation-confirmation";
import { sendFamilyMeetingConfirmationNotification } from "@/lib/family-meeting-confirmation";

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

export type TherapistAvailabilityBlock = { dayOfWeek: number; startTime: string; endTime: string };

/**
 * Janela de disponibilidade cadastrada do avaliador (professional_availability,
 * 20260909220000_professional_availability.sql) — mesma tabela que já
 * bloqueia agendamento fora do expediente no banco via
 * appointments_availability_guard. Usada aqui só pra pintar visualmente as
 * células indisponíveis no calendário de 1ª avaliação e barrar o drop antes
 * de bater no banco; a validação real continua sendo o trigger.
 */
export async function getTherapistAvailabilityAction(
  therapistId: string,
): Promise<{ success: true; blocks: TherapistAvailabilityBlock[] } | { success: false; error: string }> {
  if (!therapistId) return { success: true, blocks: [] };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("professional_availability")
      .select("day_of_week, start_time, end_time")
      .eq("profile_id", therapistId)
      .eq("active", true);

    if (error) return { success: false, error: "Não foi possível carregar a disponibilidade do avaliador." };

    return {
      success: true,
      blocks: (data ?? []).map((b) => ({ dayOfWeek: b.day_of_week, startTime: b.start_time, endTime: b.end_time })),
    };
  } catch {
    return { success: false, error: "Não foi possível carregar a disponibilidade do avaliador." };
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

  const res = await (admin as any).rpc(rpcName, rpcArgs);
  const data = res?.data;
  const error = res?.error;

  if (error) {
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }
  if (!data?.success) {
    return { success: false, error: data?.error ?? "Não foi possível agendar." };
  }

  // Disparar confirmação de data e horário com orientações do dia via Twilio WhatsApp
  await sendEvaluationConfirmationNotification({
    bookInput,
    therapistId,
    roomId,
    date,
    time,
  });

  return { success: true };
}

/** Janela mínima de antecedência que o supervisor tem pra mudar a data de uma 1ª avaliação já marcada. */
const MIN_RESCHEDULE_NOTICE_MS = 2 * 60 * 60 * 1000;

export async function rescheduleEvaluationAction(appointmentId: string, date: string, time: string, durationMinutes: number): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("starts_at, patient_id, therapist_id, room_id, is_family_meeting")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchError || !appointment) {
    return { success: false, error: "Não foi possível localizar a avaliação para reagendar." };
  }

  const msUntilCurrentStart = new Date(appointment.starts_at).getTime() - Date.now();
  if (msUntilCurrentStart < MIN_RESCHEDULE_NOTICE_MS) {
    return { success: false, error: "Não é possível mudar a data de uma avaliação com menos de 2 horas de antecedência." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const result = await rescheduleAppointmentAction(appointmentId, startsAt.toISOString(), endsAt.toISOString());

  if (result.success && appointment.patient_id && appointment.therapist_id) {
    // Reunião com responsável e 1ª avaliação usam mensagens de WhatsApp
    // diferentes (lib/family-meeting-confirmation.ts vs
    // lib/evaluation-confirmation.ts) — os dois tipos de compromisso
    // convivem no mesmo calendário de arrastar-e-soltar (ver
    // evaluation-calendar.tsx), então a notificação precisa checar
    // is_family_meeting antes de disparar.
    if (appointment.is_family_meeting) {
      await sendFamilyMeetingConfirmationNotification({
        patientId: appointment.patient_id,
        supervisorId: appointment.therapist_id,
        date,
        time,
        isReschedule: true,
      });
    } else if (appointment.room_id) {
      await sendEvaluationConfirmationNotification({
        patientId: appointment.patient_id,
        therapistId: appointment.therapist_id,
        roomId: appointment.room_id,
        date,
        time,
        isReschedule: true,
      });
    }
  }

  return result;
}
