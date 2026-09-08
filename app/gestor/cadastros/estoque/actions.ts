"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const CATEGORIES = ["teste_psicologico", "brinquedo_pedagogico", "material_consumo", "equipamento", "outros"] as const;

/**
 * Cadastro de item de estoque/almoxarifado. RLS (inventory_items_write) é o
 * portão real, restrito a gestor.
 */
export async function createInventoryItem(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const quantityAvailable = Number(formData.get("quantityAvailable"));
  const minQuantity = Number(formData.get("minQuantity"));
  const unitCost = Number(formData.get("unitCost") ?? 0);
  const location = String(formData.get("location") ?? "").trim();

  if (!name) return { success: false, error: "Dê um nome ao item." };
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { success: false, error: "Selecione uma categoria válida." };
  }
  if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
    return { success: false, error: "Quantidade disponível precisa ser um número inteiro não negativo." };
  }
  if (!Number.isInteger(minQuantity) || minQuantity < 0) {
    return { success: false, error: "Quantidade mínima precisa ser um número inteiro não negativo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    category,
    quantity_available: quantityAvailable,
    min_quantity: minQuantity,
    unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
    location: location || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível cadastrar o item — verifique se você tem permissão de gestor." };
  }

  revalidatePath("/gestor/cadastros/estoque");
  return { success: true };
}

/**
 * Registra entrada/saída e atualiza `quantity_available` do item na mesma
 * transação lógica (dois updates sequenciais — não há função RPC dedicada
 * ainda; se um dos dois falhar, o outro não é desfeito automaticamente,
 * então validamos saldo suficiente antes de tentar).
 */
export async function registerMovement(formData: FormData): Promise<ActionResult> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim();
  const relatedPatientId = String(formData.get("relatedPatientId") ?? "").trim();

  if (!itemId) return { success: false, error: "Selecione um item." };
  if (type !== "entrada" && type !== "saida") return { success: false, error: "Selecione o tipo de movimento." };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: "Informe uma quantidade inteira maior que zero." };
  }
  if (!reason) return { success: false, error: "Informe o motivo do movimento." };

  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, quantity_available")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return { success: false, error: "Item não encontrado." };
  }

  if (type === "saida" && item.quantity_available < quantity) {
    return { success: false, error: `Saldo insuficiente — disponível: ${item.quantity_available}.` };
  }

  const newQuantity = type === "entrada" ? item.quantity_available + quantity : item.quantity_available - quantity;

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ quantity_available: newQuantity })
    .eq("id", itemId);

  if (updateError) {
    return { success: false, error: "Não foi possível atualizar o saldo do item." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    type,
    quantity,
    reason,
    user_id: user?.id ?? null,
    related_patient_id: relatedPatientId || null,
  });

  if (movementError) {
    return { success: false, error: "O saldo foi atualizado, mas não foi possível registrar o movimento no histórico." };
  }

  revalidatePath("/gestor/cadastros/estoque");
  return { success: true };
}
