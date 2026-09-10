"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getBonusRows, getTierProgression, getClosedMetricHistory, type BonusRow, type TierRow, type ClosedMetricRow } from "../data";

export type { BonusRow, TierRow, ClosedMetricRow };

/**
 * Métricas de bonificação e apuração de PLR/Faixas do gestor.
 */
export async function getBonificacaoData(): Promise<{
  bonusRows: BonusRow[];
  tierRows: TierRow[];
  closedHistory: ClosedMetricRow[];
}> {
  const supabase = await createClient();
  const [bonusRows, tierRows, closedHistory] = await Promise.all([
    getBonusRows(supabase, DEV_CLINIC_ID),
    getTierProgression(supabase, DEV_CLINIC_ID),
    getClosedMetricHistory(supabase, DEV_CLINIC_ID),
  ]);
  return { bonusRows, tierRows, closedHistory };
}

export async function approveTherapistTierChange(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const profileId = String(formData.get("profile_id") ?? "");
  const tier = String(formData.get("tier") ?? "").trim();
  const newModulePrice = Number(formData.get("proposed_module_price") ?? 0);

  if (!profileId || !tier || !Number.isFinite(newModulePrice) || newModulePrice <= 0) {
    return { success: false, error: "Informe faixa e honorário por módulo válidos." };
  }

  const supabase = await createClient();

  // Herda os 3 parâmetros do módulo (atendimentos/módulo, prazo de
  // documentação, % indenização) do contrato atual do terapeuta — a
  // progressão de faixa muda o preço, não a estrutura do módulo.
  const { data: currentContract } = await supabase
    .from("therapist_contracts")
    .select("attendances_per_module, doc_deadline_days, noshow_compensation_pct")
    .eq("profile_id", profileId)
    .is("valid_to", null)
    .maybeSingle();

  const today = new Date().toISOString().split("T")[0];
  const { error: closeError } = await supabase
    .from("therapist_contracts")
    .update({ valid_to: today })
    .eq("profile_id", profileId)
    .is("valid_to", null);

  if (closeError) {
    return { success: false, error: "Não foi possível fechar a faixa anterior." };
  }

  const { error: insertError } = await supabase.from("therapist_contracts").insert({
    profile_id: profileId,
    tier,
    hourly_rate: null,
    module_price: newModulePrice,
    attendances_per_module: currentContract?.attendances_per_module ?? 6,
    doc_deadline_days: currentContract?.doc_deadline_days ?? 3,
    noshow_compensation_pct: currentContract?.noshow_compensation_pct ?? 50,
    valid_from: today,
  });

  if (insertError) {
    return { success: false, error: "Não foi possível gravar a nova faixa." };
  }

  revalidatePath("/gestor/bonificacao");
  revalidatePath("/gestor");
  revalidatePath("/gestor/financeiro");
  revalidatePath("/terapeuta/repasse");
  return { success: true };
}

export async function rejectTherapistTierChange(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const profileId = String(formData.get("profile_id") ?? "");
  const reason = String(formData.get("justification") ?? "").trim();

  if (!profileId || !reason) {
    return { success: false, error: "A justificativa para manutenção/rejeição é obrigatória." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Registra decisão no audit_log
  const { error } = await supabase.from("audit_log").insert({
    clinic_id: DEV_CLINIC_ID,
    actor_id: userData.user?.id ?? null,
    action: "REJECT_TIER_PROGRESSION",
    table_name: "therapist_contracts",
    row_id: profileId,
    after: { profile_id: profileId, rejection_reason: reason, date: new Date().toISOString() },
  });

  if (error) {
    return { success: false, error: "Falha ao gravar justificativa no audit log." };
  }

  revalidatePath("/gestor/bonificacao");
  revalidatePath("/gestor");
  return { success: true };
}
