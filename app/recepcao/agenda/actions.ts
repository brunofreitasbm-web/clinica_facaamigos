"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { getActiveAuthorizationId } from "@/lib/active-authorization";

export async function createAppointment(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const patientId = String(formData.get("patient_id") ?? "");
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!patientId || !therapistId || !roomId || !date || !time || !discipline) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000); // 50 min padrão

  const supabase = createAdminClient();

  // Sessões criadas pela agenda são sempre sessões normais (não avaliação —
  // essas são criadas por `scheduleEvaluation`), então precisam de
  // authorization_id pra satisfazer o guard `appointments_authorization_guard`
  // quando marcadas como 'realizada'.
  const authorizationId = await getActiveAuthorizationId(supabase, patientId);

  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    authorization_id: authorizationId,
  });

  if (error) {
    if (error.code === "23P01") {
      return {
        success: false,
        error: "Sala ou terapeuta já tem sessão nesse horário.",
      };
    }
    if (error.message?.includes("exige authorization_id")) {
      return {
        success: false,
        error: "Paciente sem autorização ativa — registre uma guia antes de agendar.",
      };
    }
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  return { success: true };
}
