"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";
import {
  getEvaluationCalendarAppointments,
  getEvaluationOffers,
  getEvaluationPool,
  getSchedulingGates,
  type EvaluationBookInput,
  type EvaluationCalendarAppointment,
  type EvaluationOfferItem,
  type EvaluationPoolItem,
} from "@/lib/evaluation-agenda";
import { cancelEvaluationOffer, getActiveOfferForAppointment, reofferAfterRejection, startEvaluationOffer } from "@/lib/evaluation-offer";
import { computeEvaluationOfferSlots } from "@/lib/evaluation-offer-slots";
import { dispatchAnamnesisPrefillRequest } from "@/lib/anamnesis-prefill";
import { revalidatePath } from "next/cache";
import { scheduleEvaluation } from "@/app/recepcao/pacientes/[id]/stage-actions";
import { rescheduleAppointmentAction } from "@/app/recepcao/agenda/session-actions";
import { sendEvaluationConfirmationNotification } from "@/lib/evaluation-confirmation";
import { sendEvaluationGuidanceNotification } from "@/lib/evaluation-guidance";
import { loadClinicCalendar } from "@/lib/clinic-calendar";
import type { ClinicClosure } from "@/lib/clinic-calendar-pure";

type ActionResult =
  | { success: true; requiresFamilyNotice?: boolean; /** Algo secundário falhou (ex.: convite da pré-anamnese), mas a ação principal valeu. */ warning?: string }
  | { success: false; error: string };

/** Duração fixa de toda 1ª avaliação/anamnese — mesma convenção usada em scheduleEvaluation e nos bots de WhatsApp. */
const EVALUATION_DURATION_MINUTES = 50;

export async function getEvaluationCalendarWeekAction(
  weekStartDateStr: string,
): Promise<
  { success: true; appointments: EvaluationCalendarAppointment[]; closures: ClinicClosure[] } | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const weekStartIso = zonedDateTimeToUtc(weekStartDateStr, "00:00", CLINIC_TIMEZONE).toISOString();
    // Semana de agendamento vai de Segunda a Sábado (horário comercial inclui
    // sábado de manhã) — fim exclusivo é o Domingo, Segunda + 6 dias.
    let weekEndDateStr = weekStartDateStr;
    for (let i = 0; i < 6; i++) weekEndDateStr = nextCalendarDay(weekEndDateStr);
    const weekEndIso = zonedDateTimeToUtc(weekEndDateStr, "00:00", CLINIC_TIMEZONE).toISOString();
    const [appointments, calendar] = await Promise.all([
      getEvaluationCalendarAppointments(supabase, weekStartIso, weekEndIso),
      loadClinicCalendar(supabase, weekStartDateStr, weekEndDateStr),
    ]);
    return { success: true, appointments, closures: calendar.closures };
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

export async function getEvaluationPoolAction(): Promise<
  { success: true; pool: EvaluationPoolItem[]; offers: EvaluationOfferItem[] } | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const [pool, offers] = await Promise.all([getEvaluationPool(supabase, DEV_CLINIC_ID), getEvaluationOffers(supabase)]);
    return { success: true, pool, offers };
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

/**
 * Supervisão recusa o horário que o responsável escolheu na oferta
 * automática: libera a vaga, a oferta volta a "escolha" e o responsável
 * recebe uma lista nova.
 */
export async function rejectEvaluationOfferAction(appointmentId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if ("error" in auth) return { success: false, error: auth.error };

  const offer = await getActiveOfferForAppointment(appointmentId);
  if (!offer) return { success: false, error: "Este agendamento não veio da oferta automática por WhatsApp." };

  const admin = createAdminClient();
  const { data: rpc, error: rpcErr } = await admin.rpc("reject_evaluation_offer" as never, { p_offer_id: offer.id } as never);
  const res = rpc as { success?: boolean; error?: string } | null;
  if (rpcErr || !res?.success) return { success: false, error: res?.error ?? "Não foi possível recusar o horário." };

  const reoffer = await reofferAfterRejection(offer.id);
  revalidatePath("/supervisao");
  return reoffer.success
    ? { success: true }
    : { success: false, error: `Horário liberado, mas a nova lista não foi enviada: ${reoffer.error ?? "erro desconhecido"}` };
}

/**
 * Sugestão de data para o agendamento manual: o primeiro horário vago do
 * avaliador/sala escolhidos a partir de AMANHÃ (mesma regra da oferta do bot —
 * lib/evaluation-offer-slots.ts), respeitando disponibilidade, feriados e
 * fechamentos. Só sugere: quem confirma é a supervisão no diálogo.
 */
export async function suggestNearestEvaluationSlotAction(input: {
  therapistId: string;
  roomId: string;
}): Promise<{ success: true; date: string; time: string; label: string } | { success: false; error: string }> {
  const auth = await requireManager();
  if ("error" in auth) return { success: false, error: auth.error };
  if (!input.therapistId || !input.roomId) return { success: false, error: "Escolha o avaliador e a sala." };

  try {
    const slots = await computeEvaluationOfferSlots(createAdminClient(), DEV_CLINIC_ID, {
      page: 0,
      therapistId: input.therapistId,
      roomId: input.roomId,
    });
    const first = slots[0];
    if (!first) return { success: false, error: "Sem horário vago para este avaliador e sala nos próximos 21 dias." };
    const [date, fullTime] = new Date(first.starts_at).toLocaleString("sv-SE", { timeZone: CLINIC_TIMEZONE }).split(" ");
    return { success: true, date, time: fullTime.slice(0, 5), label: first.label };
  } catch {
    return { success: false, error: "Não foi possível calcular a sugestão agora." };
  }
}

/** Nova tentativa de oferta para uma criança cuja oferta falhou, expirou ou ficou sem horário. */
export async function restartEvaluationOfferAction(patientId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if ("error" in auth) return { success: false, error: auth.error };

  const started = await startEvaluationOffer({ patientId });
  revalidatePath("/supervisao");
  if (started.status === "sent" || started.status === "duplicate") return { success: true };
  return { success: false, error: started.error };
}

/** Cancela a oferta em andamento (a supervisão agenda manualmente) e libera o telefone no bot. */
export async function cancelEvaluationOfferAction(offerId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if ("error" in auth) return { success: false, error: auth.error };

  const res = await cancelEvaluationOffer(offerId);
  if (!res.success) return { success: false, error: res.error ?? "Não foi possível cancelar a oferta." };
  revalidatePath("/supervisao");
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

/** Só supervisão/gestão confirma ou recusa horário de 1ª avaliação (o middleware já limita /supervisao; aqui a mensagem chega na tela). */
async function requireManager(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login de novo." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role && profile.role !== "supervisor" && profile.role !== "gestor") {
    return { error: "Somente supervisão ou gestão pode confirmar agendamentos." };
  }
  return { userId: user.id };
}

export async function confirmEvaluationAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if ("error" in auth) return { success: false, error: auth.error };

  const admin = createAdminClient();

  const { data: appointment, error: fetchErr } = await admin
    .from("appointments")
    .select("id, patient_id, therapist_id, room_id, starts_at, ends_at, is_provisional")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr || !appointment) {
    return { success: false, error: "Agendamento não encontrado." };
  }

  // Horário escolhido pelo responsável na oferta automática: a RPC confirma
  // appointment e oferta juntos; depois do aviso segue o link da anamnese.
  const offer = await getActiveOfferForAppointment(appointmentId);
  if (offer) {
    const { data: rpc, error: rpcErr } = await admin.rpc(
      "confirm_evaluation_offer" as never,
      { p_offer_id: offer.id, p_confirmed_by: auth.userId } as never,
    );
    const res = rpc as { success?: boolean; error?: string } | null;
    if (rpcErr || !res?.success) {
      return { success: false, error: res?.error ?? "Não foi possível confirmar o agendamento." };
    }
  } else {
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

  // Orientações do dia: depois da confirmação e antes do convite da pré-anamnese.
  await sendEvaluationGuidanceNotification(appointment.patient_id);

  let warning: string | undefined;
  if (offer) {
    const invite = await dispatchAnamnesisPrefillRequest({ patientId: appointment.patient_id, appointmentId, startsAt: appointment.starts_at });
    if (!invite.sent) warning = `O convite da pré-anamnese não foi enviado: ${invite.reason ?? "motivo desconhecido"}.`;
  }

  revalidatePath("/supervisao");
  return { success: true, warning };
}

