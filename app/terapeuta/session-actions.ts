"use server";

import { createClient } from "@/lib/supabase/server";
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

/**
 * Terapeuta confirma que o atendimento começou de fato — distingue "Na
 * Recepção" (checkin_at, feito pela recepção) de "Em Atendimento"
 * (attendance_started_at, PRD §3). RLS de appointments_update já restringe
 * a `therapist_id = auth.uid()` (ou recepcao/supervisor/gestor).
 */
export async function startAttendance(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, checkin_at, attendance_started_at, checkout_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (!appointment.checkin_at) {
    return { success: false, error: "Aguarde o check-in na recepção." };
  }
  if (appointment.checkout_at) {
    return { success: false, error: "Sessão já foi encerrada." };
  }
  if (appointment.attendance_started_at) {
    return { success: false, error: "Atendimento já iniciado." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ attendance_started_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: "Não foi possível iniciar o atendimento. Tente de novo." };
  }

  revalidatePath("/terapeuta");
  return { success: true };
}

/**
 * Check-out feito pelo próprio terapeuta ao fim do atendimento (tela "Hoje",
 * card "Agora") — mesma regra de negócio do check-out da recepção
 * (app/recepcao/agenda/session-actions.ts), mas com client de sessão em vez
 * de admin: a RLS de appointments_update já restringe a therapist_id =
 * auth.uid() (ou recepcao/supervisor/gestor), então não precisamos (nem
 * devemos) contornar com admin client aqui.
 */
export async function checkOut(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, checkin_at, checkout_at, is_evaluation, therapist_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.therapist_id !== user.id) {
    return { success: false, error: "Esta sessão não pertence a este terapeuta." };
  }
  if (!appointment.checkin_at) {
    return { success: false, error: "Aguarde o check-in na recepção." };
  }
  if (appointment.checkout_at) {
    return { success: false, error: "Check-out já registrado." };
  }

  // Sessões de avaliação não têm autorização de convênio associada — usamos
  // is_provisional para satisfazer o guard `appointments_authorization_guard`,
  // igual ao check-out da recepção.
  const { error } = await supabase
    .from("appointments")
    .update({
      checkout_at: new Date().toISOString(),
      status: "realizada",
      is_provisional: appointment.is_evaluation === true,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, error: mapAuthorizationGuardError(error.message ?? "") };
  }

  revalidatePath("/terapeuta");
  return { success: true };
}
