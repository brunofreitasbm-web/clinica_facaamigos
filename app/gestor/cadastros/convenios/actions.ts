"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import type { IntakeExtractionProfile } from "@/lib/insurance-intake-profile";

async function getGestorClinicId(supabase: any): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.clinic_id) return profile.clinic_id;
  }
  return DEV_CLINIC_ID;
}

export async function createInsurer(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const ansCode = String(formData.get("ans_code") ?? "").trim();
  const badgeColor = String(formData.get("badge_color") ?? "").trim();

  if (!name) {
    return { success: false, error: "Nome do plano de saúde é obrigatório." };
  }

  const supabase = await createClient();
  const clinicId = await getGestorClinicId(supabase);

  const payload: Record<string, any> = {
    clinic_id: clinicId,
    name,
    ans_code: ansCode || null,
  };
  if (badgeColor) {
    payload.badge_color = badgeColor;
  }

  let { error } = await supabase.from("insurers").insert(payload);

  // Fallback gracioso: se a coluna badge_color ainda não foi adicionada no Supabase,
  // insere sem ela para não impedir o cadastro do convênio.
  if (error && error.message.includes("badge_color")) {
    delete payload.badge_color;
    const fallback = await supabase.from("insurers").insert(payload);
    error = fallback.error;
  }

  if (error) {
    return {
      success: false,
      error: `Não foi possível salvar o plano de saúde: ${error.message || "Erro no banco de dados."}`,
    };
  }

  revalidatePath("/gestor/cadastros/convenios");
  return { success: true };
}

export async function updateInsurerColor(
  insurerId: string,
  badgeColor: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!insurerId) return { success: false, error: "Plano de saúde inválido." };

  const supabase = await createClient();
  const clinicId = await getGestorClinicId(supabase);

  let { error } = await supabase
    .from("insurers")
    .update({ badge_color: badgeColor || null })
    .eq("id", insurerId)
    .eq("clinic_id", clinicId);

  if (error && error.message.includes("badge_color")) {
    return {
      success: false,
      error: "A coluna de cor personalizada ainda não foi adicionada no seu banco Supabase. Execute a migration correspondente.",
    };
  }

  if (error) {
    return {
      success: false,
      error: `Não foi possível atualizar a cor do plano de saúde: ${error.message}`,
    };
  }

  revalidatePath("/gestor/cadastros/convenios");
  return { success: true };
}

export async function updateInsurer(
  insurerId: string,
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const ansCode = String(formData.get("ans_code") ?? "").trim();
  const badgeColor = String(formData.get("badge_color") ?? "").trim();

  if (!insurerId || !name) {
    return { success: false, error: "Nome do plano de saúde é obrigatório." };
  }

  const supabase = await createClient();
  const clinicId = await getGestorClinicId(supabase);

  const payload: Record<string, any> = {
    name,
    ans_code: ansCode || null,
  };
  if (badgeColor) {
    payload.badge_color = badgeColor;
  }

  let { error } = await supabase
    .from("insurers")
    .update(payload)
    .eq("id", insurerId)
    .eq("clinic_id", clinicId);

  if (error && error.message.includes("badge_color")) {
    delete payload.badge_color;
    const fallback = await supabase
      .from("insurers")
      .update(payload)
      .eq("id", insurerId)
      .eq("clinic_id", clinicId);
    error = fallback.error;
  }

  if (error) {
    return {
      success: false,
      error: `Não foi possível atualizar o plano de saúde: ${error.message}`,
    };
  }

  revalidatePath("/gestor/cadastros/convenios");
  return { success: true };
}

export async function deleteInsurer(
  insurerId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!insurerId) return { success: false, error: "Plano de saúde inválido." };

  const supabase = await createClient();
  const clinicId = await getGestorClinicId(supabase);

  const { error } = await supabase
    .from("insurers")
    .delete()
    .eq("id", insurerId)
    .eq("clinic_id", clinicId);

  if (error) {
    return {
      success: false,
      error: `Não foi possível excluir o plano de saúde. Verifique se existem pacientes ou registros vinculados. (${error.message})`,
    };
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
  if (!insurerId) return { success: false, error: "Plano de saúde inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_insurer_intake_profile", {
    p_insurer_id: insurerId,
    p_profile: profile,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o perfil de extração deste plano de saúde." };
  }

  revalidatePath("/gestor/cadastros/convenios");
  revalidatePath("/supervisao");
  return { success: true };
}
