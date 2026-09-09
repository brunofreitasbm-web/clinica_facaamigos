"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Bloco semanal de disponibilidade de um terapeuta (dia + janela de
 * horário) — base real usada pelo trigger `appointments_availability_guard`
 * (20260909220000_professional_availability.sql) pra bloquear agendamento
 * fora do expediente, em qualquer fluxo que grave em `appointments`
 * (recepção, PTS, geração de recorrência da grade).
 */
export async function addAvailabilityBlock(formData: FormData): Promise<ActionResult> {
  const profileId = String(formData.get("profile_id") ?? "");
  const dayOfWeek = Number(formData.get("day_of_week"));
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (!profileId || !startTime || !endTime) {
    return { success: false, error: "Preencha terapeuta, horário de início e de término." };
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { success: false, error: "Dia da semana inválido." };
  }
  if (startTime >= endTime) {
    return { success: false, error: "O horário de término precisa ser depois do início." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("professional_availability").insert({
    clinic_id: DEV_CLINIC_ID,
    profile_id: profileId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Já existe um bloco de horário sobreposto para esse dia." };
    }
    return { success: false, error: "Não foi possível salvar este bloco de disponibilidade." };
  }

  revalidatePath("/supervisao/disponibilidade");
  return { success: true };
}

export async function removeAvailabilityBlock(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("professional_availability").delete().eq("id", id);

  if (error) {
    return { success: false, error: "Não foi possível remover este bloco de disponibilidade." };
  }

  revalidatePath("/supervisao/disponibilidade");
  return { success: true };
}
