"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Catálogo de especialidades profissionais (musicoterapia, fisioterapia,
 * psicologia ABA, fonoaudiologia, etc.) — specialties, RLS restrita a
 * supervisor/gestor (specialties_manage_ins/upd). `value` é uma chave
 * estável que pode vir a ser referenciada por outras tabelas (ex.: perfil
 * do terapeuta); por isso não existe deleteSpecialty aqui, só
 * toggleSpecialtyActive.
 */
export async function createSpecialty(formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();

  if (!label) return { success: false, error: "Dê um nome à especialidade." };

  const value = slugify(label);
  if (!value || value.length < 2) {
    return { success: false, error: "Nome inválido — use letras ou números." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("specialties").insert({
    clinic_id: DEV_CLINIC_ID,
    value,
    label,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Já existe uma especialidade com um nome muito parecido." };
    }
    return { success: false, error: "Você não tem permissão para cadastrar especialidades." };
  }

  revalidatePath("/gestor/configuracoes/especialidades");
  return { success: true };
}

export async function renameSpecialtyLabel(specialtyId: string, formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { success: false, error: "Dê um nome à especialidade." };

  const supabase = await createClient();
  const { error } = await supabase.from("specialties").update({ label }).eq("id", specialtyId);

  if (error) {
    return { success: false, error: "Não foi possível renomear esta especialidade." };
  }

  revalidatePath("/gestor/configuracoes/especialidades");
  return { success: true };
}

export async function toggleSpecialtyActive(specialtyId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("specialties").update({ active }).eq("id", specialtyId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta especialidade." };
  }

  revalidatePath("/gestor/configuracoes/especialidades");
  return { success: true };
}
