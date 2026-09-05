"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { TARGET_ROLES, findMetricDef, formatMetricValue } from "@/lib/metric-catalog";

export type TargetRow = {
  id: string;
  role: string;
  roleLabel: string;
  metricKey: string;
  metricLabel: string;
  period: string;
  targetValue: number;
  weight: number;
  unit: "pct" | "dias" | "min" | "score";
  achievement: {
    status: "atingida" | "abaixo" | "sem_calculo";
    actualLabel: string | null;
    periodLabel: string | null;
  };
};

function evaluateDirection(actual: number, target: number, direction: "min" | "max"): boolean {
  return direction === "min" ? actual >= target : actual <= target;
}

export async function getTargetsData(): Promise<{ targets: TargetRow[]; roles: { value: Role; label: string }[] }> {
  const supabase = await createClient();

  const { data: targets } = await supabase
    .from("targets")
    .select("id, role, metric_key, period, target_value, weight")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("role")
    .order("metric_key");

  const metricKeys = [...new Set((targets ?? []).map((t) => t.metric_key))];
  const { data: snapshots } = metricKeys.length
    ? await supabase
        .from("metric_snapshots")
        .select("metric_key, period_start, value")
        .eq("scope_type", "clinica")
        .eq("scope_id", DEV_CLINIC_ID)
        .in("metric_key", metricKeys)
        .order("period_start", { ascending: false })
    : { data: [] as { metric_key: string; period_start: string; value: number }[] };

  // Última snapshot por metric_key (a query já vem ordenada desc por período).
  const latestByMetric = new Map<string, { period_start: string; value: number }>();
  for (const s of snapshots ?? []) {
    if (!latestByMetric.has(s.metric_key)) latestByMetric.set(s.metric_key, s);
  }

  const rows: TargetRow[] = (targets ?? []).map((t) => {
    const def = findMetricDef(t.role, t.metric_key);
    const unit = def?.unit ?? "pct";
    const direction = def?.direction ?? "min";
    const metricLabel = def?.label ?? t.metric_key;
    const snapshot = latestByMetric.get(t.metric_key);

    let achievement: TargetRow["achievement"] = { status: "sem_calculo", actualLabel: null, periodLabel: null };
    if (snapshot) {
      const targetFraction = unit === "pct" ? t.target_value / 100 : t.target_value;
      const met = evaluateDirection(snapshot.value, targetFraction, direction);
      const [year, month] = snapshot.period_start.split("-");
      achievement = {
        status: met ? "atingida" : "abaixo",
        actualLabel: formatMetricValue(snapshot.value, unit),
        periodLabel: `${month}/${year}`,
      };
    }

    return {
      id: t.id,
      role: t.role,
      roleLabel: ROLE_LABEL[t.role as Role] ?? t.role,
      metricKey: t.metric_key,
      metricLabel,
      period: t.period,
      targetValue: Number(t.target_value),
      weight: Number(t.weight),
      unit,
      achievement,
    };
  });

  return {
    targets: rows,
    roles: TARGET_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
  };
}

export async function createTarget(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const role = String(formData.get("role") ?? "");
  const metricKey = String(formData.get("metric_key") ?? "");
  const period = String(formData.get("period") ?? "");
  const targetValue = Number(formData.get("target_value"));
  const weight = Number(formData.get("weight"));

  if (!role || !metricKey) {
    return { success: false, error: "Selecione cargo e métrica." };
  }
  if (!["mensal", "trimestral", "semestral"].includes(period)) {
    return { success: false, error: "Período inválido." };
  }
  if (!Number.isFinite(targetValue)) {
    return { success: false, error: "Meta precisa ser um número." };
  }
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    return { success: false, error: "Peso precisa ser entre 0 e 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("targets").insert({
    clinic_id: DEV_CLINIC_ID,
    role,
    metric_key: metricKey,
    period,
    target_value: targetValue,
    weight,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar a meta. Tente de novo." };
  }

  revalidatePath("/gestor/metas");
  return { success: true };
}

export async function deleteTarget(targetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("targets").delete().eq("id", targetId);

  if (error) {
    return { success: false, error: "Não foi possível remover a meta." };
  }

  revalidatePath("/gestor/metas");
  return { success: true };
}
