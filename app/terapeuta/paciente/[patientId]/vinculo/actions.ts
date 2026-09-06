"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Registro de vínculo / relatório de acompanhamento inicial (Módulo 3 MAAIS,
 * slide 26 — "o vínculo terapêutico também vira processo"). O terapeuta
 * registra nas primeiras semanas de atendimento; a inbox da supervisão
 * alerta quando falta esse registro (ver app/supervisao/inbox-panel.tsx).
 */
export async function saveBondingReport(patientId: string, formData: FormData): Promise<ActionResult> {
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");
  const engagementScore = Number(formData.get("engagement_score") ?? 0);
  const observations = String(formData.get("observations") ?? "").trim();
  const readyToIncrease = formData.get("ready_to_increase_demands") === "on";

  if (!periodStart || !periodEnd) return { success: false, error: "Informe o período observado." };
  if (!Number.isInteger(engagementScore) || engagementScore < 1 || engagementScore > 5) {
    return { success: false, error: "Nível de engajamento precisa ser de 1 a 5." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase.from("bonding_reports").insert({
    patient_id: patientId,
    therapist_id: user.id,
    period_start: periodStart,
    period_end: periodEnd,
    engagement_score: engagementScore,
    observations: observations || null,
    ready_to_increase_demands: readyToIncrease,
  });

  if (error) return { success: false, error: "Não foi possível salvar o registro de vínculo." };

  revalidatePath(`/terapeuta/paciente/${patientId}/vinculo`);
  revalidatePath("/supervisao");
  return { success: true };
}
