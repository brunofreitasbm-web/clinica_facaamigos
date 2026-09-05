"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface PlrMetricItem {
  key: string;
  label: string;
  role: "recepcao" | "faturamento";
  targetValue: string;
  actualValue: string;
  weight: number; // ex: 20%
  scorePct: number; // ex: 100%
  isEliminatory?: boolean;
}

export interface TherapistTierProposal {
  profileId: string;
  therapistName: string;
  currentTier: string;
  currentRate: number;
  proposedTier: string;
  proposedRate: number;
  note24hRate: number; // ex: 99%
  retention90dRate: number; // ex: 95%
  therapistCancelRate: number; // ex: 1%
  status: "elegivel" | "aprovado" | "manter_faixa";
}

export async function getBonificacaoData(): Promise<{
  plrMetrics: PlrMetricItem[];
  tierProposals: TherapistTierProposal[];
}> {
  try {
    const supabase = await createClient();
    const { data: targets } = await supabase.from("targets").select("*");
    const { data: snapshots } = await supabase.from("metric_snapshots").select("*");

    if (targets && targets.length > 0 && snapshots) {
      // Se houver dados gravados no Supabase, processar aqui
    }
  } catch {
    // Fallback demo suportado
  }

  // Dados demonstrativos alinhados com o §10 do PRD
  const plrMetrics: PlrMetricItem[] = [
    {
      key: "no_show_rate",
      label: "No-Show (Faltas sem recuperação)",
      role: "recepcao",
      targetValue: "≤ 8%",
      actualValue: "5.2%",
      weight: 20,
      scorePct: 100,
    },
    {
      key: "recovery_rate",
      label: "Taxa de Recuperação de Faltas",
      role: "recepcao",
      targetValue: "≥ 40%",
      actualValue: "48.0%",
      weight: 15,
      scorePct: 100,
    },
    {
      key: "first_response_min",
      label: "Tempo de Primeiro Atendimento",
      role: "recepcao",
      targetValue: "≤ 15 min",
      actualValue: "8 min",
      weight: 10,
      scorePct: 100,
    },
    {
      key: "no_auth_sessions",
      label: "Sessões sem Guia Vigente",
      role: "recepcao",
      targetValue: "0",
      actualValue: "0",
      weight: 5,
      scorePct: 100,
      isEliminatory: true,
    },
    {
      key: "glosa_rate",
      label: "Índice de Glosa Inicial",
      role: "faturamento",
      targetValue: "≤ 4%",
      actualValue: "2.8%",
      weight: 35,
      scorePct: 100,
    },
    {
      key: "glosa_recovery",
      label: "Recuperação de Glosas",
      role: "faturamento",
      targetValue: "≥ 50%",
      actualValue: "62.0%",
      weight: 20,
      scorePct: 100,
    },
  ];

  const tierProposals: TherapistTierProposal[] = [
    {
      profileId: "t-1",
      therapistName: "Dra. Luciana Garcia (TO)",
      currentTier: "Faixa 1 · Pleno",
      currentRate: 75.0,
      proposedTier: "Faixa 2 · Especialista Sênior",
      proposedRate: 90.0,
      note24hRate: 99.2,
      retention90dRate: 96.0,
      therapistCancelRate: 0.8,
      status: "elegivel",
    },
    {
      profileId: "t-2",
      therapistName: "Dra. Patricia Lima (ABA)",
      currentTier: "Faixa 2 · Especialista Sênior",
      currentRate: 90.0,
      proposedTier: "Faixa 3 · Master",
      proposedRate: 110.0,
      note24hRate: 98.5,
      retention90dRate: 94.5,
      therapistCancelRate: 1.2,
      status: "elegivel",
    },
    {
      profileId: "t-3",
      therapistName: "Dr. Marcelo Ramos (Fono)",
      currentTier: "Faixa 1 · Pleno",
      currentRate: 75.0,
      proposedTier: "Faixa 1 · Pleno (Manter)",
      proposedRate: 75.0,
      note24hRate: 92.0, // < 98%
      retention90dRate: 88.0,
      therapistCancelRate: 3.5,
      status: "manter_faixa",
    },
  ];

  return { plrMetrics, tierProposals };
}

export async function approveTherapistTierChange(
  formData: FormData
): Promise<void> {
  const profileId = String(formData.get("profile_id") ?? "");
  const newRate = Number(formData.get("proposed_rate") ?? 0);

  try {
    const supabase = await createClient();
    if (profileId && newRate > 0) {
      await supabase.from("therapist_contracts").insert({
        profile_id: profileId,
        tier: "Faixa Reajustada",
        hourly_rate: newRate,
        valid_from: new Date().toISOString().split("T")[0],
      });
    }
  } catch {
    // Suportado em demo
  }

  revalidatePath("/gestor/bonificacao");
}
