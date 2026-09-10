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

  revalidatePath("/gestor/cadastros/especialidades");
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

  revalidatePath("/gestor/cadastros/especialidades");
  return { success: true };
}

export async function toggleSpecialtyActive(specialtyId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("specialties").update({ active }).eq("id", specialtyId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta especialidade." };
  }

  revalidatePath("/gestor/cadastros/especialidades");
  return { success: true };
}

/**
 * Quantidade de estagiários contratados para atuar nesta especialidade —
 * hoje informada manualmente pelo gestor; no futuro pode vir a ser
 * atualizada por integração externa (sistema de contratados). Alimenta o
 * Alerta de Necessidade de Estagiário em Inteligência (BI), que relaciona
 * este número com as crianças atendidas (check-in) na especialidade.
 */
export async function setSpecialtyInternCount(specialtyId: string, internCount: number): Promise<ActionResult> {
  if (!Number.isInteger(internCount) || internCount < 0) {
    return { success: false, error: "Quantidade precisa ser um número inteiro de pelo menos 0." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("specialties").update({ intern_count: internCount }).eq("id", specialtyId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta especialidade." };
  }

  revalidatePath("/gestor/cadastros/especialidades");
  revalidatePath("/gestor/inteligencia");
  return { success: true };
}
