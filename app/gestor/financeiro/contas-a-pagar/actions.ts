"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const CATEGORIES = ["aluguel", "folha", "fornecedores", "impostos", "marketing", "manutencao", "outros"] as const;

/** Cadastro de conta a pagar. RLS (accounts_payable_write) restringe a gestor. */
export async function createExpense(formData: FormData): Promise<ActionResult> {
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const recurring = formData.get("recurring") === "on";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { success: false, error: "Selecione uma categoria válida." };
  }
  if (!description) return { success: false, error: "Descreva a despesa." };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Informe um valor válido." };
  if (!dueDate) return { success: false, error: "Informe a data de vencimento." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts_payable").insert({
    clinic_id: DEV_CLINIC_ID,
    category,
    description,
    amount,
    due_date: dueDate,
    recurring,
    notes: notes || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível cadastrar a despesa — verifique se você tem permissão de gestor." };
  }

  revalidatePath("/gestor/financeiro/contas-a-pagar");
  revalidatePath("/gestor/financeiro/dre");
  return { success: true };
}

export async function markExpensePaid(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts_payable")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", expenseId);

  if (error) {
    return { success: false, error: "Não foi possível marcar a despesa como paga." };
  }

  revalidatePath("/gestor/financeiro/contas-a-pagar");
  revalidatePath("/gestor/financeiro/dre");
  return { success: true };
}

export async function cancelExpense(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts_payable").update({ status: "cancelado" }).eq("id", expenseId);

  if (error) {
    return { success: false, error: "Não foi possível cancelar a despesa." };
  }

  revalidatePath("/gestor/financeiro/contas-a-pagar");
  return { success: true };
}
