import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { findMetricDef, formatMetricValue, type MetricDef } from "@/lib/metric-catalog";
import { hoursBetween } from "@/app/gestor/data";

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
 *     para as 3 métricas com fórmula recorrente aqui (no_show_rate,
 *     occupancy_rate, glosa_rate) — igual ao que já roda em getBonusRows,
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

const LIVE_COMPUTABLE = new Set(["no_show_rate", "occupancy_rate", "glosa_rate"]);

async function computeLiveMetric(
  supabase: Supa,
  clinicId: string,
  metricKey: string,
  startISO: string,
  endISO: string,
): Promise<number | null> {
  if (metricKey === "no_show_rate" || metricKey === "occupancy_rate") {
    const { data } = await supabase
      .from("appointments")
      .select("status, starts_at, ends_at, patients!inner(clinic_id)")
      .eq("patients.clinic_id", clinicId)
      .gte("starts_at", startISO)
      .lt("starts_at", endISO);
    const list = data ?? [];
    const consideredStatuses = ["realizada", "falta_familia", "cancelada_familia", "cancelada_terapeuta", "cancelada_clinica"];
    const denom = list.filter((a) => consideredStatuses.includes(a.status));

    if (metricKey === "no_show_rate") {
      return denom.length > 0 ? denom.filter((a) => a.status === "falta_familia").length / denom.length : null;
    }
    const scheduledHours = denom.reduce((sum, a) => sum + hoursBetween(a.starts_at, a.ends_at), 0);
    const realizedHours = denom
      .filter((a) => a.status === "realizada")
      .reduce((sum, a) => sum + hoursBetween(a.starts_at, a.ends_at), 0);
    return scheduledHours > 0 ? realizedHours / scheduledHours : null;
  }

  if (metricKey === "glosa_rate") {
    const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", clinicId);
    const insurerIds = (insurers ?? []).map((i) => i.id);
    if (insurerIds.length === 0) return null;
    // billing_items não tem coluna de data própria — a competência mora em
    // billing_periods.competence_month (mesmo padrão de getBonusRows).
    const { data: periods } = await supabase
      .from("billing_periods")
      .select("id")
      .in("insurer_id", insurerIds)
      .gte("competence_month", startISO.slice(0, 10))
      .lt("competence_month", endISO.slice(0, 10));
    const periodIds = (periods ?? []).map((p) => p.id);
    if (periodIds.length === 0) return null;
    const { data: items } = await supabase.from("billing_items").select("amount, status").in("billing_period_id", periodIds);
    const list = items ?? [];
    const total = list.reduce((sum, i) => sum + Number(i.amount), 0);
    const glosado = list.filter((i) => i.status === "glosado").reduce((sum, i) => sum + Number(i.amount), 0);
    return total > 0 ? glosado / total : null;
  }

  return null;
}

async function computeSnapshotMetric(
  supabase: Supa,
  clinicId: string,
  role: string,
  metricKey: string,
  startDate: string,
  endDate: string,
): Promise<number | null> {
  if (role === "terapeuta") {
    const { data: therapists } = await supabase
      .from("profiles")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("role", "terapeuta")
      .eq("active", true);
    const ids = (therapists ?? []).map((t) => t.id);
    if (ids.length === 0) return null;
    const { data } = await supabase
      .from("metric_snapshots")
      .select("value")
      .eq("scope_type", "profile")
      .in("scope_id", ids)
      .eq("metric_key", metricKey)
      .gte("period_start", startDate)
      .lt("period_start", endDate);
    const values = (data ?? []).map((r) => Number(r.value));
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  const { data } = await supabase
    .from("metric_snapshots")
    .select("value")
    .eq("scope_type", "clinica")
    .eq("scope_id", clinicId)
    .eq("metric_key", metricKey)
    .gte("period_start", startDate)
    .lt("period_start", endDate);
  const values = (data ?? []).map((r) => Number(r.value));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

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
  const startDate = periodStartISO.slice(0, 10);
  const endDate = periodEndISO.slice(0, 10);

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
    } else if (LIVE_COMPUTABLE.has(item.metricKey)) {
      actual = await computeLiveMetric(supabase, clinicId, item.metricKey, periodStartISO, periodEndISO);
      source = actual != null ? "live" : "sem_dado";
    } else {
      actual = await computeSnapshotMetric(supabase, clinicId, role, item.metricKey, startDate, endDate);
      source = actual != null ? "snapshot" : "sem_dado";
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
