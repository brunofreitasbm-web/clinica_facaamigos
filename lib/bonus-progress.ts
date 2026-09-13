import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getActiveRuleSets, type BonusModule } from "@/lib/bonus-rules";
import { simulateBonusRuleSet, type SimItemResult } from "@/lib/bonus-simulation";

type Supa = SupabaseClient<Database>;

export type BonusProgressLevel =
  | "eliminado"
  | "abaixo_esperado"
  | "em_desenvolvimento"
  | "no_caminho_certo"
  | "quase_la"
  | "bonificado";

/**
 * Quadro percentil da bonificação: o % ponderado exato (weightedPct)
 * continua calculado e disponível pro backend/auditoria, mas a tela nunca
 * mostra o número pro usuário — só a categoria da faixa em que ele está,
 * pra reforçar a leitura qualitativa ("estou indo bem?") em vez de um
 * número frio. `min` é o piso (inclusive) de cada faixa; a faixa vencedora é
 * a de maior `min` que o weightedPct ainda cobre.
 */
export const BONUS_PERCENTILE_BANDS: {
  level: Exclude<BonusProgressLevel, "eliminado">;
  min: number;
  chipLabel: string;
  headline: string;
}[] = [
  { level: "abaixo_esperado", min: 0, chipLabel: "Abaixo do esperado", headline: "Abaixo do esperado" },
  { level: "em_desenvolvimento", min: 20, chipLabel: "Em desenvolvimento", headline: "Em desenvolvimento" },
  { level: "no_caminho_certo", min: 50, chipLabel: "No caminho certo", headline: "No caminho certo" },
  { level: "quase_la", min: 70, chipLabel: "Quase lá", headline: "Quase lá!" },
  { level: "bonificado", min: 100, chipLabel: "Bonificado!", headline: "Objetivo alcançado 🎉" },
];

const ELIMINADO_CHIP_LABEL = "Meta eliminatória";
const ELIMINADO_HEADLINE = "Meta eliminatória não cumprida";

/** Nível qualitativo de uma métrica individual — inclui "sem_dado", que não existe no placar geral (o placar geral trata "sem dado" como 0 de contribuição, mas no item isso merece um rótulo próprio em vez de virar "abaixo do esperado"). */
export type ItemQualitativeLevel = BonusProgressLevel | "sem_dado";

export type ItemQualitative = { level: ItemQualitativeLevel; chipLabel: string };

const SEM_DADO_CHIP_LABEL = "Sem dado no período";

export type BonusProgress = {
  hasRuleSet: boolean;
  eliminated: boolean;
  eliminatedBy: string[];
  weightedPct: number;
  level: BonusProgressLevel;
  /** Rótulo curto pra chip/badge — ex.: "Quase lá", "Bonificado!". */
  chipLabel: string;
  /** Frase de destaque da tela — ex.: "Quase lá!", "Bonificação garantida! 🎉". */
  levelLabel: string;
  items: SimItemResult[];
  periodLabel: string;
};

function bandFor(weightedPct: number) {
  let current = BONUS_PERCENTILE_BANDS[0];
  for (const band of BONUS_PERCENTILE_BANDS) {
    if (weightedPct >= band.min) current = band;
  }
  return current;
}

/**
 * Versão qualitativa do "realizado × meta" de uma métrica individual — pra
 * telas como BonusProgressCard não precisarem mostrar "92% / meta 95%" nem
 * "3 dias / meta 2 dias", só a categoria (mesmo vocabulário do placar
 * geral). Sem dado no período (`actual == null`) ganha rótulo próprio em vez
 * de cair em "abaixo do esperado" — a métrica não foi medida, não foi
 * necessariamente ruim.
 */
export function qualitativeForItem(item: {
  actual: number | null;
  eliminatory: boolean;
  met: boolean | null;
  contributionPct: number;
}): ItemQualitative {
  if (item.actual == null) return { level: "sem_dado", chipLabel: SEM_DADO_CHIP_LABEL };
  if (item.eliminatory && item.met === false) return { level: "eliminado", chipLabel: ELIMINADO_CHIP_LABEL };
  const band = bandFor(item.contributionPct);
  return { level: band.level, chipLabel: band.chipLabel };
}

/**
 * Progresso de bonificação do próprio usuário no mês corrente — mesma regra
 * de cálculo de app/gestor/bonificacao (simulateBonusRuleSet sobre a
 * vigência ativa de bonus_rule_sets), só que amarrada ao cargo/pessoa
 * logada em vez de uma tabela pro gestor auditar. Sem vigência configurada
 * pro cargo, retorna hasRuleSet=false — nunca inventa meta.
 */
export async function getMyBonusProgress(
  supabase: Supa,
  clinicId: string,
  role: string,
  module: BonusModule = "bonificacao",
): Promise<BonusProgress> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const periodLabel = start
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/^\w/, (c) => c.toUpperCase());

  const ruleSets = await getActiveRuleSets(supabase, clinicId);
  const ruleSet = ruleSets.find((s) => s.role === role && s.module === module);

  if (!ruleSet || ruleSet.items.length === 0) {
    return {
      hasRuleSet: false,
      eliminated: false,
      eliminatedBy: [],
      weightedPct: 0,
      level: "abaixo_esperado",
      chipLabel: "Sem meta",
      levelLabel: "Sem meta configurada pelo gestor ainda",
      items: [],
      periodLabel,
    };
  }

  const sim = await simulateBonusRuleSet(
    supabase,
    clinicId,
    role,
    ruleSet.items,
    start.toISOString(),
    end.toISOString(),
  );

  if (sim.eliminated) {
    return {
      hasRuleSet: true,
      eliminated: true,
      eliminatedBy: sim.eliminatedBy,
      weightedPct: sim.weightedPct,
      level: "eliminado",
      chipLabel: ELIMINADO_CHIP_LABEL,
      levelLabel: ELIMINADO_HEADLINE,
      items: sim.items,
      periodLabel,
    };
  }

  const band = bandFor(sim.weightedPct);

  return {
    hasRuleSet: true,
    eliminated: false,
    eliminatedBy: [],
    weightedPct: sim.weightedPct,
    level: band.level,
    chipLabel: band.chipLabel,
    levelLabel: band.headline,
    items: sim.items,
    periodLabel,
  };
}
