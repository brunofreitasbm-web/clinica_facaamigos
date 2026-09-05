// app/recepcao/agenda/session-actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_RECEPTION_PROFILE_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

const ADMIN_CLIENT_ERROR: ActionResult = {
  success: false,
  error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.",
};

function mapAuthorizationGuardError(message: string): string {
  if (message.includes("exige authorization_id")) {
    return "Sessão sem autorização vinculada — não é possível fechar.";
  }
  if (message.includes("não está ativa")) {
    return "Autorização não está mais ativa.";
  }
  if (message.includes("fora da vigência")) {
    return "Sessão fora da vigência da autorização.";
  }
  if (message.includes("sem sessões restantes")) {
    return "Autorização sem sessões restantes.";
  }
  return "Não foi possível fechar a sessão. Tente de novo.";
}

// Home da recepção (app/recepcao/page.tsx) reusa estas mesmas actions pra
// não duplicar a lógica de check-in/check-out/falta/confirmação — por isso
// cada uma revalida as duas rotas.
function revalidateAgendaViews() {
  revalidatePath("/recepcao/agenda");
  revalidatePath("/recepcao");
}

export async function confirmAppointment(appointmentId: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return ADMIN_CLIENT_ERROR;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "agendada") {
    return { success: false, error: "Só é possível confirmar sessão ainda a confirmar." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "confirmada", confirmed_at: new Date().toISOString(), confirmed_via: "recepcao" })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível confirmar. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

export async function checkIn(appointmentId: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return ADMIN_CLIENT_ERROR;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status, checkin_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return { success: false, error: "Só é possível fazer check-in de sessão agendada ou confirmada." };
  }
  if (appointment.checkin_at) {
    return { success: false, error: "Check-in já registrado." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ checkin_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar o check-in. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

export async function checkOut(appointmentId: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return ADMIN_CLIENT_ERROR;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, checkin_at, checkout_at, is_evaluation, is_provisional")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (!appointment.checkin_at) {
    return { success: false, error: "Registre o check-in antes do check-out." };
  }
  if (appointment.checkout_at) {
    return { success: false, error: "Check-out já registrado." };
  }

  // Sessões de avaliação não têm autorização de convênio associada — usamos
  // is_provisional para satisfazer o guard `appointments_authorization_guard`,
  // que exige authorization_id em qualquer status='realizada' não provisório.
  // Mesmo padrão de markEvaluationDone (app/recepcao/pacientes/[id]/stage-actions.ts).
  // Preserva um is_provisional=true já gravado na criação da sessão (ex.: a
  // recepção marcou "provisória" ao agendar por falta de guia vigente — ver
  // app/recepcao/nova-sessao-dialog.tsx) — sem isso, esse OR sempre reavaliava
  // só is_evaluation e apagava a marcação da sessão no check-out.
  const { error } = await supabase
    .from("appointments")
    .update({
      checkout_at: new Date().toISOString(),
      status: "realizada",
      is_provisional: appointment.is_evaluation === true || appointment.is_provisional === true,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: mapAuthorizationGuardError(error.message ?? "") };
  }

  revalidateAgendaViews();
  return { success: true };
}

export async function markMissedOrCancelled(
  appointmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const targetStatus = String(formData.get("target_status") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const reasonOther = String(formData.get("reason_other") ?? "").trim();

  if (!NEGATIVE_STATUSES.some((s) => s.value === targetStatus)) {
    return { success: false, error: "Selecione um status válido." };
  }
  if (!CANCEL_REASONS.some((r) => r.value === reason)) {
    return { success: false, error: "Selecione um motivo válido." };
  }
  if (reason === "outro" && !reasonOther) {
    return { success: false, error: "Descreva o motivo." };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return ADMIN_CLIENT_ERROR;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return { success: false, error: "Essa sessão já não pode mais ser cancelada." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      status: targetStatus,
      cancel_reason: reason === "outro" ? reasonOther : reason,
      cancelled_by: DEV_RECEPTION_PROFILE_ID,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

const WEEKDAY_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export type AvailableSlot = {
  dateLabel: string;
  timeLabel: string;
  startsAtIso: string;
  endsAtIso: string;
};

/**
 * Vagas livres reais pra sala+terapeuta dessa sessão, nos próximos 5 dias,
 * em horário comercial (08h–19h, passo de 30min) — substitui os `mockSlots`
 * hardcoded que existiam em app/recepcao/agenda/reagendamento-dialog.tsx
 * (dados fixos, sem nenhuma consulta ao banco).
 */
export async function getAvailableSlots(
  roomId: string,
  therapistId: string,
  durationMinutes: number,
  excludeAppointmentId: string,
): Promise<AvailableSlot[]> {
  const supabase = createAdminClient();

  const days: string[] = [];
  let cursor = todayInTimeZone(CLINIC_TIMEZONE);
  for (let i = 0; i < 5; i++) {
    days.push(cursor);
    cursor = nextCalendarDay(cursor);
  }

  const rangeStart = zonedDateTimeToUtc(days[0], "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(nextCalendarDay(days[days.length - 1]), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: busy } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, room_id, therapist_id, status")
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .neq("id", excludeAppointmentId)
    .not(
      "status",
      "in",
      "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,falta_familia)",
    )
    .or(`room_id.eq.${roomId},therapist_id.eq.${therapistId}`);

  const busyRanges = (busy ?? []).map((b) => ({
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  const now = Date.now();
  const slots: AvailableSlot[] = [];

  for (const day of days) {
    for (let hour = 8; hour < 19 && slots.length < 8; hour++) {
      for (const minute of [0, 30]) {
        if (slots.length >= 8) break;
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
      }
    }
  }

  return slots;
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  newStartsAtIso: string,
  newEndsAtIso: string
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: newStartsAtIso,
      ends_at: newEndsAtIso,
      status: "agendada",
      cancelled_at: null,
      cancel_reason: null,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível reagendar a sessão. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}
