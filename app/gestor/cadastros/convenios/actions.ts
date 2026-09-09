"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import type { IntakeExtractionProfile } from "@/lib/insurance-intake-profile";

export async function createInsurer(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const ansCode = String(formData.get("ans_code") ?? "").trim();

  if (!name) {
    return { success: false, error: "Nome do convênio é obrigatório." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("insurers").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    ans_code: ansCode || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o convênio. Tente de novo." };
  }

  revalidatePath("/gestor/cadastros/convenios");
  return { success: true };
}

/**
 * Salva o perfil de extração por convênio ("campos por plano de saúde") do
 * acolhimento oriundo de plano de saúde — dicas de layout, palavras-chave
 * de detecção e mapeamento de colunas que ajudam o Gemini a ler o PDF
 * específico deste convênio (lib/insurance-intake-extraction.ts). Chama a
 * função SQL `set_insurer_intake_profile` (security definer), que confere
 * gestor/supervisor e o convênio pertencer à clínica do usuário — nunca
 * confiar só na policy genérica de `insurers` (essa é gestor-only).
 */
export async function setInsurerIntakeProfile(
  insurerId: string,
  profile: IntakeExtractionProfile,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!insurerId) return { success: false, error: "Convênio inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_insurer_intake_profile", {
    p_insurer_id: insurerId,
    p_profile: profile,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o perfil de extração deste convênio." };
  }

  revalidatePath("/gestor/cadastros/convenios");
  revalidatePath("/supervisao");
  return { success: true };
}
