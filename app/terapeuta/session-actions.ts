"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

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
