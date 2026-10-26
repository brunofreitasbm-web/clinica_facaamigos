"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";
import {
  getEvaluationCalendarAppointments,
  getEvaluationPool,
  getSchedulingGates,
  type EvaluationBookInput,
  type EvaluationCalendarAppointment,
  type EvaluationPoolItem,
} from "@/lib/evaluation-agenda";
import { scheduleEvaluation } from "@/app/recepcao/pacientes/[id]/stage-actions";
import { rescheduleAppointmentAction } from "@/app/recepcao/agenda/session-actions";
import { sendEvaluationConfirmationNotification } from "@/lib/evaluation-confirmation";
import { formatE164Phone } from "@/lib/twilio";
import { sendWhatsApp } from "@/lib/whatsapp";
import { computeAvailableSlots } from "@/lib/available-slots";

type ActionResult = { success: true; requiresFamilyNotice?: boolean } | { success: false; error: string };

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

/**
 * Quantidade de avaliações agendadas por dia civil (`YYYY-MM-DD`) no intervalo
 * [startDateStr, endDateStr] — alimenta os indicadores do calendário mensal.
 */
export async function getEvaluationDayCountsAction(
  startDateStr: string,
  endDateStr: string,
): Promise<{ success: true; counts: Record<string, number> } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const startIso = zonedDateTimeToUtc(startDateStr, "00:00", CLINIC_TIMEZONE).toISOString();
    const endIso = zonedDateTimeToUtc(nextCalendarDay(endDateStr), "00:00", CLINIC_TIMEZONE).toISOString();
    const appointments = await getEvaluationCalendarAppointments(supabase, startIso, endIso);
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      const day = fmt.format(new Date(a.startsAt));
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return { success: true, counts };
  } catch {
    return { success: false, error: "Não foi possível carregar o mês." };
  }
}

export async function getEvaluationPoolAction():Promise<{ success: true; pool: EvaluationPoolItem[] } | { success: false; error: string }> {
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
    // Paciente que veio de contato de documentos só agenda com o "ok" da
    // Recepção (linha do tempo da Fila de pendências) — a fila lateral já
    // esconde o arraste, mas quem manda é o servidor.
    const gate = (await getSchedulingGates(await createClient(), [bookInput.patientId])).get(bookInput.patientId);
    if (gate && gate !== "habilitado") {
      return { success: false, error: "A Recepção ainda não habilitou este paciente para agendamento (autorização do plano pendente)." };
    }

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

export async function rescheduleEvaluationAction(appointmentId: string, date: string, time: string, durationMinutes: number): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchError || !appointment) {
    return { success: false, error: "Não foi possível localizar a avaliação para reagendar." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const result = await rescheduleAppointmentAction(appointmentId, startsAt.toISOString(), endsAt.toISOString());

  if (!result.success) return result;

  // Reagendamento feito pelo Supervisor NÃO dispara WhatsApp automático pro
  // responsável (diferente do agendamento inicial) — o Supervisor precisa
  // avaliar o motivo da mudança antes de avisar a família, então a UI só
  // mostra um lembrete flutuante pedindo pra avisar manualmente.
  return { success: true, requiresFamilyNotice: Boolean(appointment.patient_id) };
}

export async function updateEvaluationAppointmentAction({
  appointmentId,
  date,
  time,
  therapistId,
  roomId,
  durationMinutes = EVALUATION_DURATION_MINUTES,
}: {
  appointmentId: string;
  date: string;
  time: string;
  therapistId: string;
  roomId: string;
  durationMinutes?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();

  if (!appointmentId || !date || !time || !therapistId || !roomId) {
    return { success: false, error: "Preencha data, horário, terapeuta e sala." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      therapist_id: therapistId,
      room_id: roomId,
      status: "agendada",
      cancelled_at: null,
      cancel_reason: null,
    })
    .eq("id", appointmentId);

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Sala ou terapeuta já tem sessão nesse horário." };
    }
    return { success: false, error: "Não foi possível atualizar o agendamento." };
  }

  return { success: true };
}

export async function cancelEvaluationAppointmentAction(
  appointmentId: string,
  reason: string = "Desmarcado pelo supervisor no calendário",
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelada_clinica",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível desmarcar a avaliação." };
  }

  return { success: true };
}

export async function sendEvaluationOfferViaWhatsAppAction({
  patientId,
  therapistId,
  roomId,
  customPhone,
}: {
  patientId: string;
  therapistId: string;
  roomId: string;
  customPhone?: string;
}): Promise<ActionResult> {
  if (!patientId || !therapistId || !roomId) {
    return { success: false, error: "Selecione o terapeuta e a sala para gerar os horários." };
  }

  const admin = createAdminClient();

  const [{ data: patient }, { data: guardians }, { data: draft }] = await Promise.all([
    admin.from("patients").select("id, full_name").eq("id", patientId).maybeSingle(),
    admin.from("guardians").select("full_name, phone, is_financial").eq("patient_id", patientId),
    admin.from("registration_drafts").select("source_phone").eq("patient_id", patientId).limit(1).maybeSingle(),
  ]);

  if (!patient) {
    return { success: false, error: "Paciente não encontrado." };
  }

  const rawPhone =
    customPhone ||
    (guardians ?? []).find((g) => g.is_financial)?.phone ||
    (guardians ?? [])[0]?.phone ||
    draft?.source_phone ||
    "";

  const phoneE164 = formatE164Phone(rawPhone);
  if (!phoneE164) {
    return { success: false, error: "Paciente sem telefone de responsável válido para WhatsApp." };
  }

  const rawSlots = await computeAvailableSlots(admin, {
    therapistId,
    roomId,
    durationMinutes: EVALUATION_DURATION_MINUTES,
    limit: 3,
    maxPerDay: 1,
    daysAhead: 10,
  });

  if (rawSlots.length === 0) {
    return { success: false, error: "Nenhum horário livre encontrado nos próximos 10 dias para esse terapeuta e sala." };
  }

  const offeredSlots = rawSlots.map((s, index) => ({
    index: index + 1,
    label: `${s.dateLabel} às ${s.timeLabel}`,
    starts_at: s.startsAtIso,
    ends_at: s.endsAtIso,
    therapist_id: therapistId,
    room_id: roomId,
  }));

  // Grava sessão no chatbot_sessions para o webhook capturar a resposta 1, 2 ou 3
  await admin.from("chatbot_sessions").upsert(
    {
      phone_number: phoneE164,
      flow: "intake",
      current_step: "intake_awaiting_slot",
      collected_data: {
        patient_id: patient.id,
        child_name: patient.full_name,
        available_slots: offeredSlots,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" }
  );

  const slotListText = offeredSlots.map((s) => `*${s.index}* - ${s.label}`).join("\n");
  const messageText =
    `Olá! 💙 Equipe Faça Amigos aqui.\n\n` +
    `Temos uma ótima notícia: a documentação e autorização do plano de *${patient.full_name}* estão prontas para a 1ª Avaliação!\n\n` +
    `Separamos 3 opções de horários com nossos especialistas para você escolher:\n\n` +
    `${slotListText}\n\n` +
    `👉 *Responda apenas com o número da sua opção (ex: 1, 2 ou 3)* para reservarmos o horário!`;

  const twilioRes = await sendWhatsApp({
    to: phoneE164,
    message: messageText,
  });

  if (!twilioRes.success) {
    return { success: false, error: `Não foi possível enviar mensagem WhatsApp via Twilio: ${twilioRes.error}` };
  }

  return { success: true };
}

export async function confirmEvaluationAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const admin = createAdminClient();

  const { data: appointment, error: fetchErr } = await admin
    .from("appointments")
    .select("id, patient_id, therapist_id, room_id, starts_at, ends_at, is_provisional")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr || !appointment) {
    return { success: false, error: "Agendamento não encontrado." };
  }

  const { error: updateErr } = await admin
    .from("appointments")
    .update({
      is_provisional: false,
      confirmed_at: new Date().toISOString(),
      confirmed_via: "whatsapp_supervisor_ok",
      status: "confirmada",
    })
    .eq("id", appointmentId);

  if (updateErr) {
    return { success: false, error: "Não foi possível confirmar o agendamento." };
  }

  // Extrair data e hora
  const [date, fullTime] = new Date(appointment.starts_at)
    .toLocaleString("sv-SE", { timeZone: CLINIC_TIMEZONE })
    .split(" ");
  const time = fullTime.slice(0, 5);

  // Disparar WhatsApp com a confirmação final e orientações
  await sendEvaluationConfirmationNotification({
    patientId: appointment.patient_id,
    therapistId: appointment.therapist_id,
    roomId: appointment.room_id,
    date,
    time,
  });

  return { success: true };
}

