import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { findMetricDef, formatMetricValue, type MetricDef } from "@/lib/metric-catalog";
import { computeMetricActual } from "@/lib/metric-compute";

type Supa = SupabaseClient<Database>;

/**
 * Motor de simulação de PLR/bonificação (§10.6 do PRD). Recebe um conjunto
 * de métricas com peso/meta/eliminatória (vindo de `bonus_rule_sets` ou de
 * um rascunho ainda não salvo) e um período, e devolve o % ponderado que
 * teria sido atingido.
 *
 * Fonte do "realizado" por métrica, em ordem de prioridade:
 *  1. `overrides[metric_key]` — valor hipotético digitado pelo gestor
 *     (fração, ex.: 0.05 para 5%) — cobre métricas ainda sem pipeline real
 *     (`computed: false` no catálogo) e cenários "e se".
 *  2. Cálculo ao vivo sobre `appointments`/`billing_items` do período pedido,
 *     para as 4 métricas com fórmula recorrente aqui (no_show_rate,
 *     occupancy_rate, glosa_rate, intake_complete_rate) — igual ao que já
 *     roda em getBonusRows,
 *     mas parametrizado por período em vez de fixo no mês corrente.
 *  3. Média das linhas fechadas em `metric_snapshots` que caem dentro do
 *     período (grava pelo job close_monthly_metric_snapshots) — só existe
 *     para meses já fechados.
 * Sem nenhuma das três, a métrica fica "sem dado" e não contribui pro
 * ponderado — nunca inventamos número.
 */

export type SimRuleItem = {
  metricKey: string;
  weightPct: number;
  targetValue: number;
  eliminatory: boolean;
};

export type SimItemResult = {
  metricKey: string;
  label: string;
  unit: MetricDef["unit"];
  direction: "min" | "max";
  weightPct: number;
  targetValue: number;
  targetLabel: string;
  eliminatory: boolean;
  actual: number | null;
  actualLabel: string;
  source: "override" | "live" | "snapshot" | "sem_dado";
  met: boolean | null;
  contributionPct: number;
};

export type SimResult = {
  items: SimItemResult[];
  weightedPct: number;
  eliminated: boolean;
  eliminatedBy: string[];
  totalWeight: number;
};

function evalItem(actual: number | null, target: number, direction: "min" | "max"): { met: boolean | null; contributionPct: number } {
  if (actual == null) return { met: null, contributionPct: 0 };
  if (direction === "max") {
    const met = actual <= target;
    const contributionPct = Math.min(100, Math.round((target / Math.max(actual, 0.0001)) * 100));
    return { met, contributionPct };
  }
  const met = actual >= target;
  const contributionPct = Math.min(100, Math.round((actual / Math.max(target, 0.0001)) * 100));
  return { met, contributionPct };
}

export async function simulateBonusRuleSet(
  supabase: Supa,
  clinicId: string,
  role: string,
  items: SimRuleItem[],
  periodStartISO: string,
  periodEndISO: string,
  overrides: Record<string, number> = {},
): Promise<SimResult> {
  const results: SimItemResult[] = [];
  for (const item of items) {
    const def = findMetricDef(role, item.metricKey);
    const direction = def?.direction ?? "min";
    const unit = def?.unit ?? "pct";
    const label = def?.label ?? item.metricKey;

    let actual: number | null = null;
    let source: SimItemResult["source"] = "sem_dado";

    if (Object.prototype.hasOwnProperty.call(overrides, item.metricKey) && Number.isFinite(overrides[item.metricKey])) {
      actual = overrides[item.metricKey];
      source = "override";
    } else {
      const computed = await computeMetricActual(supabase, clinicId, role, item.metricKey, periodStartISO, periodEndISO);
      actual = computed.actual;
      source = computed.source;
    }

    const targetFraction = unit === "pct" ? item.targetValue / 100 : item.targetValue;
    const { met, contributionPct } = evalItem(actual, targetFraction, direction);

    results.push({
      metricKey: item.metricKey,
      label,
      unit,
      direction,
      weightPct: item.weightPct,
      targetValue: item.targetValue,
      targetLabel: unit === "pct" ? `${item.targetValue}%` : formatMetricValue(item.targetValue, unit),
      eliminatory: item.eliminatory,
      actual,
      actualLabel: actual != null ? formatMetricValue(actual, unit) : "sem dado",
      source,
      met,
      contributionPct,
    });
  }

  const eliminatedBy = results.filter((r) => r.eliminatory && r.met === false).map((r) => r.label);
  const eliminated = eliminatedBy.length > 0;

  // §10.6.2: "realizado × meta × peso → % atingido" — soma ponderada do
  // atingimento proporcional de cada métrica (contributionPct, já limitado a
  // 100%), não um binário bateu/não bateu meta.
  const totalWeight = results.reduce((sum, r) => sum + r.weightPct, 0);
  const weightedPct = eliminated
    ? 0
    : totalWeight > 0
      ? Math.round(results.reduce((sum, r) => sum + (r.weightPct * r.contributionPct) / 100, 0))
      : 0;

  return { items: results, weightedPct, eliminated, eliminatedBy, totalWeight };
}
