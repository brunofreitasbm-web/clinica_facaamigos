"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/gestor/convenios");
  return { success: true };
}
