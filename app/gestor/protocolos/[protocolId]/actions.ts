"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

export async function createProtocolItem(protocolId: string, formData: FormData): Promise<ActionResult> {
  const domain = String(formData.get("domain") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const itemCode = String(formData.get("item_code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!domain) {
    return { success: false, error: "Domínio é obrigatório." };
  }
  if (!itemCode) {
    return { success: false, error: "Código do item é obrigatório." };
  }
  if (!description) {
    return { success: false, error: "Descrição é obrigatória." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("protocol_items").insert({
    protocol_id: protocolId,
    domain,
    level: level || null,
    item_code: itemCode,
    description,
  });

  if (error) {
    return {
      success: false,
      error: "Não foi possível salvar o item. Verifique se você tem permissão (gestor ou supervisor) e tente de novo.",
    };
  }

  revalidatePath(`/gestor/protocolos/${protocolId}`);
  revalidatePath("/gestor/cadastros");
  return { success: true };
}

export async function deleteProtocolItem(protocolId: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("protocol_items").delete().eq("id", itemId);

  if (error) {
    return { success: false, error: "Não foi possível remover o item. Tente de novo." };
  }

  revalidatePath(`/gestor/protocolos/${protocolId}`);
  revalidatePath("/gestor/cadastros");
  return { success: true };
}
