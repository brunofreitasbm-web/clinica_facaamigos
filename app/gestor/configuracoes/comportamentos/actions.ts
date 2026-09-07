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
 * Catálogo de comportamentos-alvo (PRD §9.4 "lista configurável pelo
 * supervisor") — behavior_catalog, RLS restrita a supervisor/gestor
 * (behavior_catalog_manage_ins/upd). `value` vira a chave gravada dentro de
 * session_notes.structured (append-only): por isso não existe deleteBehavior
 * aqui, só toggleBehaviorActive.
 */
export async function createBehavior(formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!label) return { success: false, error: "Dê um nome ao comportamento." };

  const value = slugify(label);
  if (!value || value.length < 2) {
    return { success: false, error: "Nome inválido — use letras ou números." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("behavior_catalog").insert({
    clinic_id: DEV_CLINIC_ID,
    value,
    label,
    discipline: discipline || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Já existe um comportamento com um nome muito parecido." };
    }
    return { success: false, error: "Você não tem permissão para cadastrar comportamentos." };
  }

  revalidatePath("/gestor/configuracoes/comportamentos");
  return { success: true };
}

export async function renameBehaviorLabel(behaviorId: string, formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { success: false, error: "Dê um nome ao comportamento." };

  const supabase = await createClient();
  // Só o rótulo muda — `value` é a chave gravada dentro de evoluções já
  // assinadas e não pode ser alterada (session_notes é append-only).
  const { error } = await supabase.from("behavior_catalog").update({ label }).eq("id", behaviorId);

  if (error) {
    return { success: false, error: "Não foi possível renomear este comportamento." };
  }

  revalidatePath("/gestor/configuracoes/comportamentos");
  return { success: true };
}

export async function toggleBehaviorActive(behaviorId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("behavior_catalog").update({ active }).eq("id", behaviorId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar este comportamento." };
  }

  revalidatePath("/gestor/configuracoes/comportamentos");
  return { success: true };
}
