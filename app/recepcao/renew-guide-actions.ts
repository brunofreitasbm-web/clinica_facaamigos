"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

/**
 * Registra que a recepção acionou o responsável para renovar a guia (clique em
 * "Renovar guia"). Cada clique grava uma linha; o card mostra o mais recente.
 */
export async function registerRenewalContact(patientId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase
    .from("guide_renewal_contacts")
    .insert({ clinic_id: DEV_CLINIC_ID, patient_id: patientId, contacted_by: user.id });
  if (error) return { success: false, error: "Não foi possível registrar o contato." };

  revalidatePath("/recepcao");
  return { success: true };
}
