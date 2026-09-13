"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getMyBonusProgress, type BonusProgressLevel } from "@/lib/bonus-progress";

export type BonusWidgetSummary = {
  eliminated: boolean;
  /** Só usado internamente pra calcular a tendência (crescendo/caindo) — nunca exibido como número na tela. */
  weightedPct: number;
  level: BonusProgressLevel;
  chipLabel: string;
  levelLabel: string;
  href: string;
};

/**
 * Só os dois cargos pedidos pro widget flutuante (recepção e coordenação
 * clínica) — terapeuta e faturamento já têm o cartão completo na própria
 * tela de "Minha bonificação" e não pediram o flutuante.
 */
const WIDGET_ROLE_HREF: Record<string, string> = {
  recepcao: "/recepcao/metricas",
  supervisor: "/supervisao/metricas",
};

/**
 * Resumo leve pro widget flutuante (components/bonus-floating-widget.tsx) —
 * chamado via polling pelo client, então fica enxuto (sem a lista de
 * métricas item a item que o BonusProgressCard mostra na tela cheia).
 * `null` quando o usuário não está logado, não tem cargo elegível ao
 * widget, ou não tem vigência de bonificação configurada pelo gestor.
 */
export async function getMyBonusWidgetSummary(): Promise<BonusWidgetSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const href = profile ? WIDGET_ROLE_HREF[profile.role] : undefined;
  if (!href) return null;

  const progress = await getMyBonusProgress(supabase, DEV_CLINIC_ID, profile!.role);
  if (!progress.hasRuleSet) return null;

  return {
    eliminated: progress.eliminated,
    weightedPct: progress.weightedPct,
    level: progress.level,
    chipLabel: progress.chipLabel,
    levelLabel: progress.levelLabel,
    href,
  };
}
