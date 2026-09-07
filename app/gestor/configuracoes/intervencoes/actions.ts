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
 * Catálogo de intervenções do terapeuta — intervention_catalog, RLS
 * restrita a supervisor/gestor (intervention_catalog_manage_ins/upd). Mesmo
 * desenho de app/gestor/configuracoes/comportamentos/actions.ts:
 * `value` vira a chave gravada em session_intervention_logs.intervention_value,
 * então não existe delete aqui, só toggleInterventionActive.
 */
export async function createIntervention(formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!label) return { success: false, error: "Dê um nome à intervenção." };

  const value = slugify(label);
  if (!value || value.length < 2) {
    return { success: false, error: "Nome inválido — use letras ou números." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("intervention_catalog").insert({
    clinic_id: DEV_CLINIC_ID,
    value,
    label,
    discipline: discipline || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Já existe uma intervenção com um nome muito parecido." };
    }
    return { success: false, error: "Você não tem permissão para cadastrar intervenções." };
  }

  revalidatePath("/gestor/configuracoes/intervencoes");
  return { success: true };
}

export async function renameInterventionLabel(interventionId: string, formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { success: false, error: "Dê um nome à intervenção." };

  const supabase = await createClient();
  // Só o rótulo muda — `value` é a chave gravada em intervenções já
  // registradas e não pode ser alterada (session_intervention_logs é
  // append-only).
  const { error } = await supabase.from("intervention_catalog").update({ label }).eq("id", interventionId);

  if (error) {
    return { success: false, error: "Não foi possível renomear esta intervenção." };
  }

  revalidatePath("/gestor/configuracoes/intervencoes");
  return { success: true };
}

export async function toggleInterventionActive(interventionId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("intervention_catalog").update({ active }).eq("id", interventionId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta intervenção." };
  }

  revalidatePath("/gestor/configuracoes/intervencoes");
  return { success: true };
}
