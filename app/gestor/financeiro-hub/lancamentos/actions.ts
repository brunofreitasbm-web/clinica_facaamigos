"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { upsertMonthlyEntry, upsertBalanceEntry } from "@/lib/finance-hub/repo";

type ActionResult = { success: true } | { success: false; error: string };

function num(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const parsed = Number(String(raw ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Salva o lançamento manual mensal (DRE) de uma unidade. RLS restringe a gestor/faturamento. */
export async function saveMonthlyEntry(formData: FormData): Promise<ActionResult> {
  const unitId = String(formData.get("unitId") ?? "");
  const competenceMonth = String(formData.get("competenceMonth") ?? "");
  const status = formData.get("status") === "fechado" ? "fechado" : "aberto";
  if (!unitId || !/^\d{4}-\d{2}$/.test(competenceMonth)) {
    return { success: false, error: "Unidade ou mês inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login novamente." };

  try {
    await upsertMonthlyEntry(supabase, {
      unitId,
      competenceMonth,
      custosDiretosManuais: num(formData, "custosDiretosManuais"),
      despesasOperacionaisManuais: num(formData, "despesasOperacionaisManuais"),
      impostos: num(formData, "impostos"),
      depreciacao: num(formData, "depreciacao"),
      receitasFinanceiras: num(formData, "receitasFinanceiras"),
      despesasFinanceiras: num(formData, "despesasFinanceiras"),
      retiradasSocios: num(formData, "retiradasSocios"),
      aportesSocios: num(formData, "aportesSocios"),
      ajusteManual: num(formData, "ajusteManual"),
      ajusteManualNota: String(formData.get("ajusteManualNota") ?? "").trim() || null,
      observacoes: String(formData.get("observacoes") ?? "").trim() || null,
      status,
      filledBy: user.id,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar — verifique sua permissão de gestor." };
  }

  revalidatePath("/gestor/financeiro-hub");
  revalidatePath("/gestor/financeiro-hub/fluxo-caixa");
  revalidatePath("/gestor/financeiro-hub/lancamentos");
  return { success: true };
}

/** Salva um saldo de conta do Balanço Patrimonial para uma unidade/mês. */
export async function saveBalanceEntry(formData: FormData): Promise<ActionResult> {
  const accountId = String(formData.get("accountId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const competenceMonth = String(formData.get("competenceMonth") ?? "");
  if (!accountId || !unitId || !/^\d{4}-\d{2}$/.test(competenceMonth)) {
    return { success: false, error: "Conta, unidade ou mês inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login novamente." };

  try {
    await upsertBalanceEntry(supabase, {
      accountId,
      unitId,
      competenceMonth,
      valor: num(formData, "valor"),
      updatedBy: user.id,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar — verifique sua permissão de gestor." };
  }

  revalidatePath("/gestor/financeiro-hub/balanco");
  revalidatePath("/gestor/financeiro-hub/lancamentos");
  return { success: true };
}
