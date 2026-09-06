// app/recepcao/agenda/session-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { zonedDateTimeToUtc, todayInTimeZone, nextCalendarDay } from "@/lib/timezone";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true; warning?: string } | { success: false; error: string };

const SESSION_EXPIRED_ERROR: ActionResult = {
  success: false,
  error: "Sessão expirada. Faça login novamente.",
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
  const supabase = await createClient();

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

/**
 * Checagem da guia no check-in (Gap 3 do audit de recepção): não bloqueia o
 * check-in — a família já está na clínica e a recepção pode preferir deixar
 * entrar e resolver a cobrança depois — mas devolve um aviso pra UI exibir,
 * já que o único bloqueio hoje é o trigger `appointments_authorization_guard`
 * no check-out, tarde demais pra agir (a sessão já aconteceu).
 */
async function buildAuthorizationWarning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
): Promise<string | undefined> {
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "authorization_id, starts_at, is_provisional, is_evaluation, authorizations(status, valid_from, valid_to, sessions_used, sessions_authorized, password_valid_until)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment || appointment.is_evaluation || appointment.is_provisional) {
    return undefined;
  }

  if (!appointment.authorization_id) {
    return "Sessão sem guia de convênio vinculada.";
  }

  const authorization = appointment.authorizations as {
    status: string;
    valid_from: string;
    valid_to: string;
    sessions_used: number;
    sessions_authorized: number;
    password_valid_until: string | null;
  } | null;

  if (!authorization) {
    return "Guia vinculada não foi encontrada.";
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);

  if (authorization.status !== "ativa") {
    return "Guia vinculada não está mais ativa.";
  }
  if (today < authorization.valid_from || today > authorization.valid_to) {
    return "Sessão fora da vigência da guia.";
  }
  if (authorization.sessions_used >= authorization.sessions_authorized) {
    return "Guia sem sessões restantes.";
  }
  if (authorization.password_valid_until && authorization.password_valid_until < today) {
    return "Senha de autorização da guia está vencida.";
  }

  return undefined;
}

export async function checkIn(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

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

  const warning = await buildAuthorizationWarning(supabase, appointmentId);

  const { error } = await supabase
    .from("appointments")
    .update({ checkin_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar o check-in. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true, warning };
}

export async function checkOut(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

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

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return SESSION_EXPIRED_ERROR;
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
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

/**
 * Preenche o motivo de uma falta marcada automaticamente pela rotina de
 * baixa de presença (auto_resolve_appointments, roda a cada 5 min via
 * pg_cron — supabase/migrations/20260906000016_auto_attendance_resolution.sql).
 * A rotina só sabe dizer "não teve check-in", não o porquê; quem sabe é a
 * recepção, ao ligar pra família ou ver o motivo relatado no portal. Só
 * aceita em cima de auto_marked=true pra não virar uma segunda porta de
 * edição de falta manual (essa já existe em markMissedOrCancelled).
 */
export async function setAutoFaltaReason(appointmentId: string, formData: FormData): Promise<ActionResult> {
  const reason = String(formData.get("reason") ?? "");
  const reasonOther = String(formData.get("reason_other") ?? "").trim();

  if (!CANCEL_REASONS.some((r) => r.value === reason)) {
    return { success: false, error: "Selecione um motivo válido." };
  }
  if (reason === "outro" && !reasonOther) {
    return { success: false, error: "Descreva o motivo." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return SESSION_EXPIRED_ERROR;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appointment } = await (supabase as any)
    .from("appointments")
    .select("id, status, auto_marked, cancel_reason")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "falta_familia" || !appointment.auto_marked) {
    return { success: false, error: "Essa sessão não é uma falta automática pendente de motivo." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      cancel_reason: reason === "outro" ? reasonOther : reason,
      cancelled_by: user.id,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível registrar o motivo. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

/**
 * Desfaz uma falta marcada automaticamente (a família chegou atrasada, mas
 * dentro do que a recepção considera aceitável, ou o check-in não foi
 * registrado por falha operacional) — devolve a sessão pra 'confirmada' e
 * limpa os campos que a rotina automática gravou, pra o check-in normal
 * (checkIn, acima) poder seguir o fluxo de novo. Só age sobre auto_marked
 * pra nunca reverter uma falta que a recepção decidiu de propósito.
 */
export async function undoAutoFalta(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appointment } = await (supabase as any)
    .from("appointments")
    .select("id, status, auto_marked, checkout_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "falta_familia" || !appointment.auto_marked) {
    return { success: false, error: "Essa sessão não é uma falta automática." };
  }
  if (appointment.checkout_at) {
    return { success: false, error: "Sessão já foi encerrada." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("appointments")
    .update({
      status: "confirmada",
      cancel_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      auto_marked: false,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível desfazer a falta. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

/**
 * Vincula uma guia à sessão depois de criada (Gap 3 do audit de recepção) —
 * cobre o caso da sessão "provisória" agendada antes da guia chegar (ver
 * `is_provisional` em app/recepcao/nova-sessao-dialog.tsx). Só permite
 * setar quando ainda não há authorization_id, pra não sobrescrever um
 * vínculo já feito (e já contabilizado pelo guard de check-out).
 */
export async function linkAuthorizationToAppointment(
  appointmentId: string,
  authorizationId: string,
): Promise<ActionResult> {
  if (!authorizationId) {
    return { success: false, error: "Selecione uma guia." };
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, authorization_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.authorization_id) {
    return { success: false, error: "Essa sessão já tem guia vinculada." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ authorization_id: authorizationId })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível vincular a guia. Tente de novo." };
  }

  revalidateAgendaViews();
  return { success: true };
}

export type PatientAuthorizationOption = {
  id: string;
  guideNumber: string | null;
  procedureCode: string;
  sessionsUsed: number;
  sessionsAuthorized: number;
  validTo: string;
};

/**
 * Guias ativas do paciente pra popular o dropdown "Vincular guia" (Gap 3) —
 * busca client-side a partir do botão na linha da sessão, sem precisar
 * carregar isso pra toda a agenda do dia.
 */
export async function getPatientActiveAuthorizations(
  patientId: string,
): Promise<PatientAuthorizationOption[]> {
  const supabase = await createClient();

  const { data: patientInsurances } = await supabase
    .from("patient_insurance")
    .select("id")
    .eq("patient_id", patientId);

  const insuranceIds = (patientInsurances ?? []).map((pi) => pi.id);
  if (insuranceIds.length === 0) return [];

  const { data: authorizations } = await supabase
    .from("authorizations")
    .select("id, guide_number, procedure_code, sessions_used, sessions_authorized, valid_to")
    .in("patient_insurance_id", insuranceIds)
    .eq("status", "ativa");

  return (authorizations ?? []).map((a) => ({
    id: a.id,
    guideNumber: a.guide_number,
    procedureCode: a.procedure_code,
    sessionsUsed: a.sessions_used,
    sessionsAuthorized: a.sessions_authorized,
    validTo: a.valid_to,
  }));
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
  const supabase = await createClient();

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
  const supabase = await createClient();

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
