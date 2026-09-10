import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

/**
 * Cálculo de métrica "ao vivo"/snapshot compartilhado entre
 * lib/bonus-simulation.ts e app/gestor/data.ts (getBonusRows) — extraído
 * pra cá pra evitar import circular (data.ts precisa disso, e
 * bonus-simulation.ts importava hoursBetween de data.ts).
 */
export function hoursBetween(startsAt: string, endsAt: string): number {
  return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
}

/**
 * Categorias de `documents` que compõem o checklist de entrada
 * (app/recepcao/checklist-entrada-dialog.tsx, categorias criadas em
 * 20260906000006_intake_documents.sql). `carteirinha` fica de fora desta
 * lista porque só é exigida de paciente com convênio — ver
 * INTAKE_INSURANCE_CATEGORY e a checagem em computeLiveMetric.
 */
export const INTAKE_REQUIRED_CATEGORIES = [
  "pedido_medico",
  "documento_responsavel",
  "termo_lgpd",
  "termo_imagem",
  "contrato",
] as const;
export const INTAKE_INSURANCE_CATEGORY = "carteirinha";

export const LIVE_COMPUTABLE = new Set(["no_show_rate", "occupancy_rate", "glosa_rate", "intake_complete_rate"]);

export async function computeLiveMetric(
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

  /**
   * intake_complete_rate (§10.1): meta operacional da recepção que substituiu
   * no_show_rate — ver 20260910071000_intake_complete_rate_metric.sql, que
   * calcula exatamente a mesma coisa no fechamento mensal.
   *
   * Denominador: pacientes cuja 1ª sessão caiu no período. Numerador: os que
   * tinham todos os documentos obrigatórios anexados ANTES da 1ª sessão —
   * anexar depois não conta, senão a métrica premiaria o cadastro atrasado.
   */
  if (metricKey === "intake_complete_rate") {
    const { data: newPatients } = await supabase
      .from("patients")
      .select("id, first_session_at")
      .eq("clinic_id", clinicId)
      .gte("first_session_at", startISO)
      .lt("first_session_at", endISO);
    const cohort = (newPatients ?? []).filter((p) => p.first_session_at != null);
    if (cohort.length === 0) return null;

    const ids = cohort.map((p) => p.id);
    const [{ data: docs }, { data: insurances }] = await Promise.all([
      supabase.from("documents").select("patient_id, category, uploaded_at").in("patient_id", ids),
      supabase.from("patient_insurance").select("patient_id, is_private").in("patient_id", ids),
    ]);

    const withInsurer = new Set(
      (insurances ?? []).filter((i) => i.is_private === false).map((i) => i.patient_id),
    );
    const complete = cohort.filter((p) => {
      const deadline = new Date(p.first_session_at as string).getTime();
      const onTime = new Set(
        (docs ?? [])
          .filter((d) => d.patient_id === p.id && new Date(d.uploaded_at).getTime() <= deadline)
          .map((d) => d.category),
      );
      if (!INTAKE_REQUIRED_CATEGORIES.every((c) => onTime.has(c))) return false;
      // Carteirinha só é cobrada de quem tem convênio: particular sem
      // carteirinha não é cadastro incompleto.
      return !withInsurer.has(p.id) || onTime.has(INTAKE_INSURANCE_CATEGORY);
    });

    return complete.length / cohort.length;
  }

  if (metricKey === "glosa_rate") {
    const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", clinicId);
    const insurerIds = (insurers ?? []).map((i) => i.id);
    if (insurerIds.length === 0) return null;
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

export async function computeSnapshotMetric(
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

/** Busca o valor "realizado" de uma métrica: ao vivo se computável, senão média dos snapshots fechados do período. */
export async function computeMetricActual(
  supabase: Supa,
  clinicId: string,
  role: string,
  metricKey: string,
  startISO: string,
  endISO: string,
): Promise<{ actual: number | null; source: "live" | "snapshot" | "sem_dado" }> {
  if (LIVE_COMPUTABLE.has(metricKey)) {
    const actual = await computeLiveMetric(supabase, clinicId, metricKey, startISO, endISO);
    return { actual, source: actual != null ? "live" : "sem_dado" };
  }
  const actual = await computeSnapshotMetric(supabase, clinicId, role, metricKey, startISO.slice(0, 10), endISO.slice(0, 10));
  return { actual, source: actual != null ? "snapshot" : "sem_dado" };
}
