"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000); // 50 min padrão

  const supabase = createAdminClient();
  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
  });

  if (error) {
    if (error.code === "23P01") {
      return {
        success: false,
        error: "Sala ou terapeuta já tem sessão nesse horário.",
      };
    }
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  return { success: true };
}
