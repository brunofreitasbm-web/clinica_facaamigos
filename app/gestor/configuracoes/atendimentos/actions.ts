"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { RESOURCE_CATEGORIES } from "@/lib/resource-categories";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Cadastro de recurso (PRD §10) — RLS (resources_manage_gestor_supervisor)
 * é o portão real, restrito a gestor/supervisor. Fica em Configurações
 * porque é cadastro mestre; a recepção só reserva (`/recepcao/recursos`).
 */
export async function createResource(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { success: false, error: "Dê um nome ao recurso." };
  if (!RESOURCE_CATEGORIES.some((c) => c.value === category)) {
    return { success: false, error: "Selecione uma categoria válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    category,
    notes: notes || null,
  });

  if (error) {
    return { success: false, error: "Você não tem permissão para cadastrar recursos." };
  }

  revalidatePath("/gestor/configuracoes/atendimentos");
  revalidatePath("/recepcao/recursos");
  return { success: true };
}
