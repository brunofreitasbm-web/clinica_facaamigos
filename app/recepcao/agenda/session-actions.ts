// app/recepcao/agenda/session-actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_RECEPTION_PROFILE_ID } from "@/lib/constants";
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

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
  const supabase = createAdminClient();

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
  const supabase = createAdminClient();

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
  const supabase = createAdminClient();

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

  const supabase = createAdminClient();

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
