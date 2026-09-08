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

  revalidatePath("/gestor/cadastros/salas");
  revalidatePath("/recepcao/recursos");
  return { success: true };
}

/**
 * Cadastro de sala física — a agenda inteira (recepção, grade recorrente,
 * check-in/check-out) depende de `rooms` existir, mas não havia tela
 * nenhuma pra criar uma sala além de inserir direto no banco. RLS
 * (rooms_manage_by_supervisor_gestor_*) é o portão real, gestor/supervisor.
 */
export async function createRoom(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 1);

  if (!name) return { success: false, error: "Dê um nome à sala." };
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { success: false, error: "Capacidade precisa ser um número inteiro de pelo menos 1." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({ clinic_id: DEV_CLINIC_ID, name, capacity });

  if (error) {
    return { success: false, error: "Você não tem permissão para cadastrar salas." };
  }

  revalidatePath("/gestor/cadastros/salas");
  return { success: true };
}

export async function updateRoom(roomId: string, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 1);

  if (!name) return { success: false, error: "Dê um nome à sala." };
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { success: false, error: "Capacidade precisa ser um número inteiro de pelo menos 1." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update({ name, capacity }).eq("id", roomId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta sala." };
  }

  revalidatePath("/gestor/cadastros/salas");
  return { success: true };
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    // appointments.room_id é FK sem cascade — sala com sessão associada
    // (passada ou futura) não pode ser excluída, só editada.
    return {
      success: false,
      error: "Não foi possível excluir esta sala — ela já tem sessões associadas na agenda.",
    };
  }

  revalidatePath("/gestor/cadastros/salas");
  return { success: true };
}
