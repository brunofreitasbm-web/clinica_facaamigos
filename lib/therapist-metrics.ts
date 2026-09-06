import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { METRIC_CATALOG, formatMetricValue, type MetricDirection } from "@/lib/metric-catalog";

type Supa = SupabaseClient<Database>;

export type TherapistMetricRow = {
  key: string;
  label: string;
  direction: MetricDirection;
  computed: boolean;
  valueLabel: string | null;
  periodLabel: string | null;
};

/**
 * Métricas pessoais do terapeuta (PRD §10.3/§4) — mesma fonte que
 * app/gestor/metas/actions.ts usa pra cargo (metric_snapshots,
 * scope_type='profile'), mas aqui já filtrado pro próprio terapeuta. A RLS
 * de metric_snapshots (metric_snapshots_read) já garante que um terapeuta
 * só lê scope_id = auth.uid() — não é preciso checar aqui de novo.
 */
export async function getMyTherapistMetrics(supabase: Supa, therapistId: string): Promise<TherapistMetricRow[]> {
  const defs = METRIC_CATALOG.terapeuta ?? [];
  const keys = defs.map((d) => d.key);

  const { data } = keys.length
    ? await supabase
        .from("metric_snapshots")
        .select("metric_key, period_start, value")
        .eq("scope_type", "profile")
        .eq("scope_id", therapistId)
        .in("metric_key", keys)
        .order("period_start", { ascending: false })
    : { data: [] as { metric_key: string; period_start: string; value: number }[] };

  const latestByMetric = new Map<string, { period_start: string; value: number }>();
  for (const s of data ?? []) {
    if (!latestByMetric.has(s.metric_key)) latestByMetric.set(s.metric_key, s);
  }

  return defs.map((def) => {
    const snapshot = latestByMetric.get(def.key);
    if (!def.computed || !snapshot) {
      return {
        key: def.key,
        label: def.label,
        direction: def.direction,
        computed: def.computed,
        valueLabel: null,
        periodLabel: null,
      };
    }
    const [year, month] = snapshot.period_start.split("-");
    return {
      key: def.key,
      label: def.label,
      direction: def.direction,
      computed: true,
      valueLabel: formatMetricValue(Number(snapshot.value), def.unit),
      periodLabel: `${month}/${year}`,
    };
  });
}
