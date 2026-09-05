"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const MODALITIES = ["presencial", "remoto"] as const;
const RECURRENCES = ["unica", "semanal", "quinzenal", "mensal"] as const;

function parseInput(formData: FormData): { data: AppointmentTypeInput } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const modality = String(formData.get("modality") ?? "");
  const durationMinutes = Number(formData.get("duration_minutes"));
  const displayIntervalMinutes = Number(formData.get("display_interval_minutes"));
  const recurrence = String(formData.get("recurrence") ?? "");

  if (!name) return { error: "Nome do tipo de atendimento é obrigatório." };
  if (!MODALITIES.includes(modality as (typeof MODALITIES)[number])) return { error: "Escolha uma modalidade válida." };
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return { error: "Duração precisa ser um número de minutos maior que zero." };
  if (!Number.isInteger(displayIntervalMinutes) || displayIntervalMinutes <= 0)
    return { error: "Exibição precisa ser um número de minutos maior que zero." };
  if (!RECURRENCES.includes(recurrence as (typeof RECURRENCES)[number])) return { error: "Escolha uma recorrência válida." };

  return {
    data: { name, modality, durationMinutes, displayIntervalMinutes, recurrence },
  };
}

type AppointmentTypeInput = {
  name: string;
  modality: string;
  durationMinutes: number;
  displayIntervalMinutes: number;
  recurrence: string;
};

export async function createAppointmentType(formData: FormData): Promise<ActionResult> {
  const parsed = parseInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("appointment_types").insert({
    clinic_id: DEV_CLINIC_ID,
    name: parsed.data.name,
    modality: parsed.data.modality,
    duration_minutes: parsed.data.durationMinutes,
    display_interval_minutes: parsed.data.displayIntervalMinutes,
    recurrence: parsed.data.recurrence,
  });

  if (error) {
    return {
      success: false,
      error: error.code === "23505" ? "Já existe um tipo de atendimento com esse nome." : "Não foi possível salvar o tipo de atendimento. Tente de novo.",
    };
  }

  revalidatePath("/gestor/atendimentos");
  revalidatePath("/gestor/cadastros");
  return { success: true };
}

export async function updateAppointmentType(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointment_types")
    .update({
      name: parsed.data.name,
      modality: parsed.data.modality,
      duration_minutes: parsed.data.durationMinutes,
      display_interval_minutes: parsed.data.displayIntervalMinutes,
      recurrence: parsed.data.recurrence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: error.code === "23505" ? "Já existe um tipo de atendimento com esse nome." : "Não foi possível salvar o tipo de atendimento. Tente de novo.",
    };
  }

  revalidatePath("/gestor/atendimentos");
  revalidatePath("/gestor/cadastros");
  return { success: true };
}

export async function deleteAppointmentType(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("appointment_types").delete().eq("id", id);

  if (error) {
    return { success: false, error: "Não foi possível excluir o tipo de atendimento. Tente de novo." };
  }

  revalidatePath("/gestor/atendimentos");
  revalidatePath("/gestor/cadastros");
  return { success: true };
}
