"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getBonusRows, getTierProgression, getClosedMetricHistory, type BonusRow, type TierRow, type ClosedMetricRow } from "../data";

export type { BonusRow, TierRow, ClosedMetricRow };

/**
 * Métricas de bonificação: cálculo ao vivo direto das tabelas operacionais
 * (mesma função usada no painel executivo em app/gestor/page.tsx) para o mês
 * em andamento. `close_monthly_metric_snapshots` (migrations 20260904000027
 * e 20260905150000) já fecha boa parte do §10 em `metric_snapshots` no dia 1,
 * mas isso ainda não vira apuração ponderada por peso nem PDF de PLR — então,
 * em vez de inventar uma média ponderada, mostramos o indicador real de cada
 * cargo contra a meta do PRD (§10) e o status calculado.
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
  const newRate = Number(formData.get("proposed_rate") ?? 0);

  if (!profileId || !tier || !Number.isFinite(newRate) || newRate <= 0) {
    return { success: false, error: "Informe faixa e valor-hora válidos." };
  }

  const supabase = await createClient();

  // Faixa é revisão contratual: fecha a vigência da anterior antes de abrir a
  // nova, pra nunca ter duas faixas "vigentes" pro mesmo terapeuta ao mesmo
  // tempo (a constraint EXCLUDE de therapist_contracts já bloqueia isso, mas
  // fechar explicitamente deixa o histórico auditável).
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
    hourly_rate: newRate,
    valid_from: today,
  });

  if (insertError) {
    return { success: false, error: "Não foi possível gravar a nova faixa." };
  }

  revalidatePath("/gestor/bonificacao");
  revalidatePath("/gestor");
  return { success: true };
}
