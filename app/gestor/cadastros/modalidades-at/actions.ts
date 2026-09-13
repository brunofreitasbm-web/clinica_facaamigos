"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Catálogo de modalidade de Acompanhamento Terapêutico (escolar, domiciliar,
 * comunitária, clínica…) — at_modalities, RLS restrita a supervisor/gestor
 * (at_modalities_manage_*, 20260913040000_at_therapeutic_followup.sql).
 * Referenciada por at_sessions.modality_id, por isso não existe delete aqui,
 * só toggleAtModalityActive (mesmo racional de especialidades-manager.tsx).
 */
export async function createAtModality(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) return { success: false, error: "Dê um nome à modalidade." };

  const supabase = await createClient();
  const { error } = await supabase.from("at_modalities").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    description,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Já existe uma modalidade com esse nome." };
    }
    return { success: false, error: "Você não tem permissão para cadastrar modalidades." };
  }

  revalidatePath("/gestor/cadastros/modalidades-at");
  return { success: true };
}

export async function toggleAtModalityActive(modalityId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("at_modalities").update({ active }).eq("id", modalityId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta modalidade." };
  }

  revalidatePath("/gestor/cadastros/modalidades-at");
  return { success: true };
}
