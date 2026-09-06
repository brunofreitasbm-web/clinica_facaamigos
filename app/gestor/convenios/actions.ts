"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function createInsurer(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const ansCode = String(formData.get("ans_code") ?? "").trim();
  const providerCode = String(formData.get("provider_code") ?? "").trim();

  if (!name) {
    return { success: false, error: "Nome do convênio é obrigatório." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("insurers").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    ans_code: ansCode || null,
    provider_code: providerCode || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o convênio. Tente de novo." };
  }

  revalidatePath("/gestor/convenios");
  return { success: true };
}

/** Preenche/atualiza o código do prestador na operadora — usado no cabeçalho do lote TISS (app/faturamento/guias). */
export async function updateInsurerProviderCode(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const providerCode = String(formData.get("provider_code") ?? "").trim();

  if (!insurerId) {
    return { success: false, error: "Convênio inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("insurers")
    .update({ provider_code: providerCode || null })
    .eq("id", insurerId);

  if (error) {
    return { success: false, error: "Não foi possível salvar o código do prestador." };
  }

  revalidatePath("/gestor/convenios");
  revalidatePath("/faturamento/guias");
  return { success: true };
}
