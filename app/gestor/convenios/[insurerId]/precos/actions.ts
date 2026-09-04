"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPriceTableEntry(
  insurerId: string,
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const procedureName = String(formData.get("procedure_name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const validFrom = String(formData.get("valid_from") ?? "").trim();
  const validTo = String(formData.get("valid_to") ?? "").trim();

  if (!procedureCode) {
    return { success: false, error: "Código do procedimento é obrigatório." };
  }

  if (!procedureName) {
    return { success: false, error: "Nome do procedimento é obrigatório." };
  }

  const price = Number(priceRaw.replace(",", "."));
  if (!priceRaw || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: "Preço é obrigatório e deve ser maior que zero." };
  }

  if (!validFrom) {
    return { success: false, error: "Data de início da vigência é obrigatória." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("insurer_price_tables").insert({
    insurer_id: insurerId,
    procedure_code: procedureCode,
    procedure_name: procedureName,
    price,
    valid_from: validFrom,
    valid_to: validTo || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o preço. Tente de novo." };
  }

  revalidatePath(`/gestor/convenios/${insurerId}/precos`);
  return { success: true };
}
