"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function createSystemUser(data: {
  fullName: string;
  email: string;
  role: string;
  councilType?: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("profiles").insert({
    id: crypto.randomUUID(),
    clinic_id: DEV_CLINIC_ID,
    full_name: data.fullName,
    role: data.role,
    council_type: data.councilType || null,
    active: true,
  });

  if (error) {
    throw new Error(`Erro ao criar usuário: ${error.message}`);
  }

  revalidatePath("/gestor/configuracoes/usuarios");
  return { success: true };
}

export async function updateSystemUser(
  userId: string,
  data: {
    fullName: string;
    role: string;
    councilType?: string;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      role: data.role,
      council_type: data.councilType || null,
    })
    .eq("id", userId)
    .eq("clinic_id", DEV_CLINIC_ID);

  if (error) {
    throw new Error(`Erro ao atualizar usuário: ${error.message}`);
  }

  revalidatePath("/gestor/configuracoes/usuarios");
  return { success: true };
}

export async function toggleSystemUserActive(userId: string, active: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", userId)
    .eq("clinic_id", DEV_CLINIC_ID);

  if (error) {
    throw new Error(`Erro ao alterar status do usuário: ${error.message}`);
  }

  revalidatePath("/gestor/configuracoes/usuarios");
  return { success: true };
}
