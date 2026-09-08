"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

export async function createPriority(
  formData: FormData
): Promise<ActionResult> {
  const insurance_id = String(formData.get("insurance_id") ?? "").trim();
  const priority_level = parseInt(String(formData.get("priority_level") ?? "0"));
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "#6366f1").trim();

  if (!insurance_id) {
    return { success: false, error: "Selecione um plano de saúde." };
  }

  if (!label) {
    return { success: false, error: "Dê um rótulo à prioridade." };
  }

  if (priority_level < 1 || priority_level > 10) {
    return {
      success: false,
      error: "O nível de prioridade deve estar entre 1 e 10.",
    };
  }

  const supabase = await createClient();

  // Check if priority level already exists for this insurer
  const { data: existing, error: checkError } = await supabase
    .from("evaluation_appointment_priorities")
    .select("id")
    .eq("insurance_id", insurance_id)
    .eq("priority_level", priority_level)
    .eq("clinic_id", DEV_CLINIC_ID)
    .single();

  if (existing) {
    return {
      success: false,
      error: `Já existe uma prioridade de nível ${priority_level} para este convênio.`,
    };
  }

  const { error } = await supabase
    .from("evaluation_appointment_priorities")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      insurance_id,
      priority_level,
      label,
      description: description || null,
      color,
    });

  if (error) {
    console.error("Error creating priority:", error);
    return {
      success: false,
      error: "Você não tem permissão para criar prioridades.",
    };
  }

  revalidatePath("/gestor/configuracoes/prioridades-avaliacao");
  return { success: true };
}

export async function updatePriority(
  priorityId: string,
  updates: { label: string; description: string; color: string }
): Promise<ActionResult> {
  const { label, description, color } = updates;

  if (!label) {
    return { success: false, error: "Dê um rótulo à prioridade." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("evaluation_appointment_priorities")
    .update({
      label,
      description: description || null,
      color,
      updated_at: new Date().toISOString(),
    })
    .eq("id", priorityId)
    .eq("clinic_id", DEV_CLINIC_ID);

  if (error) {
    console.error("Error updating priority:", error);
    return {
      success: false,
      error: "Não foi possível atualizar esta prioridade.",
    };
  }

  revalidatePath("/gestor/configuracoes/prioridades-avaliacao");
  return { success: true };
}

export async function togglePriorityActive(
  priorityId: string,
  active: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("evaluation_appointment_priorities")
    .update({
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", priorityId)
    .eq("clinic_id", DEV_CLINIC_ID);

  if (error) {
    console.error("Error toggling priority:", error);
    return {
      success: false,
      error: "Não foi possível atualizar esta prioridade.",
    };
  }

  revalidatePath("/gestor/configuracoes/prioridades-avaliacao");
  return { success: true };
}

export async function deletePriority(priorityId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("evaluation_appointment_priorities")
    .delete()
    .eq("id", priorityId)
    .eq("clinic_id", DEV_CLINIC_ID);

  if (error) {
    console.error("Error deleting priority:", error);
    return {
      success: false,
      error: "Não foi possível deletar esta prioridade.",
    };
  }

  revalidatePath("/gestor/configuracoes/prioridades-avaliacao");
  return { success: true };
}
