import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ProgramTrend = {
  programId: string;
  programName: string;
  weeks: { weekStart: string; pctCorrect: number | null; trials: number }[];
};

export type DomainAverage = {
  domain: string;
  pctCorrect: number;
  trials: number;
};

export type DomainGoalCounts = {
  domain: string;
  ativa: number;
  atingida: number;
  suspensa: number;
};

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Item 7 do PRD "11 incrementos": dashboard de evolução clínica do
 * paciente. Não existe um "metric_snapshots" pronto pra isso —
 * `metric_snapshots`/`targets` (20260904000011_metrics.sql) são métricas
 * de negócio por terapeuta/clínica/convênio (NPS, ocupação), não progresso
 * clínico por paciente. A fonte real de progresso ao longo do tempo é
 * `trial_data` (coleta ABA por tentativa) cruzada com `programs`/
 * `plan_goals` (que carregam o domínio: motor, fala, social, autonomia…).
 * RLS de trial_data (trial_data_read) já restringe a leitura ao terapeuta
 * dono do appointment (ou gestor/supervisor), então esta função assume que
 * quem chama já tem esse acesso.
 */
export async function getPatientProgramTrends(
  supabase: SupabaseClient<Database>,
  patientId: string,
  maxPrograms = 4,
): Promise<{ trends: ProgramTrend[]; domainAverages: DomainAverage[] }> {
  const { data: appointmentIds } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId);

  const ids = (appointmentIds ?? []).map((a) => a.id);
  if (ids.length === 0) return { trends: [], domainAverages: [] };

  const { data: trials } = await supabase
    .from("trial_data")
    .select("program_id, result, recorded_at")
    .in("appointment_id", ids);

  if (!trials?.length) return { trends: [], domainAverages: [] };

  const programIds = [...new Set(trials.map((t) => t.program_id))];
  const { data: programs } = await supabase.from("programs").select("id, name, plan_goal_id").in("id", programIds);

  const planGoalIds = [...new Set((programs ?? []).map((p) => p.plan_goal_id))];
  const { data: goals } = planGoalIds.length
    ? await supabase.from("plan_goals").select("id, domain").in("id", planGoalIds)
    : { data: [] as { id: string; domain: string }[] };

  const domainByPlanGoalId = new Map((goals ?? []).map((g) => [g.id, g.domain]));
  const programById = new Map((programs ?? []).map((p) => [p.id, p]));

  // Trilha por programa (linha do tempo semanal) — só programas com mais
  // tentativas registradas entram (cap de séries pra manter o gráfico legível).
  const trialsByProgram = new Map<string, typeof trials>();
  for (const t of trials) {
    if (t.result === "nao_aplicado") continue;
    const list = trialsByProgram.get(t.program_id) ?? [];
    list.push(t);
    trialsByProgram.set(t.program_id, list);
  }

  const topPrograms = [...trialsByProgram.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxPrograms);

  const trends: ProgramTrend[] = topPrograms.map(([programId, programTrials]) => {
    const byWeek = new Map<string, { correct: number; total: number }>();
    for (const t of programTrials) {
      const week = mondayOf(t.recorded_at);
      const bucket = byWeek.get(week) ?? { correct: 0, total: 0 };
      if (t.result === "correto") bucket.correct += 1;
      bucket.total += 1;
      byWeek.set(week, bucket);
    }
    const weeks = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, { correct, total }]) => ({
        weekStart,
        pctCorrect: total > 0 ? Math.round((correct / total) * 100) : null,
        trials: total,
      }));

    return {
      programId,
      programName: programById.get(programId)?.name ?? "Programa",
      weeks,
    };
  });

  // Média por domínio (últimos 60 dias) — comparação entre domínios (PRD
  // §7: "marcos motores, fala, autonomia comportamental").
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const domainAgg = new Map<string, { correct: number; total: number }>();
  for (const t of trials) {
    if (t.result === "nao_aplicado" || t.recorded_at < cutoff) continue;
    const planGoalId = programById.get(t.program_id)?.plan_goal_id;
    const domain = planGoalId ? (domainByPlanGoalId.get(planGoalId) ?? "outro") : "outro";
    const bucket = domainAgg.get(domain) ?? { correct: 0, total: 0 };
    if (t.result === "correto") bucket.correct += 1;
    bucket.total += 1;
    domainAgg.set(domain, bucket);
  }

  const domainAverages: DomainAverage[] = [...domainAgg.entries()]
    .map(([domain, { correct, total }]) => ({
      domain,
      pctCorrect: Math.round((correct / total) * 100),
      trials: total,
    }))
    .sort((a, b) => b.trials - a.trials);

  return { trends, domainAverages };
}

/**
 * Contagem de metas por domínio/status do plano aprovado mais recente —
 * parte-todo por domínio (ativa/atingida/suspensa), PRD §7.
 */
export async function getPatientGoalCountsByDomain(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<DomainGoalCounts[]> {
  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return [];

  const { data: goals } = await supabase
    .from("plan_goals")
    .select("domain, status")
    .eq("treatment_plan_id", plan.id);

  const byDomain = new Map<string, DomainGoalCounts>();
  for (const g of goals ?? []) {
    const row = byDomain.get(g.domain) ?? { domain: g.domain, ativa: 0, atingida: 0, suspensa: 0 };
    if (g.status === "ativa") row.ativa += 1;
    else if (g.status === "atingida") row.atingida += 1;
    else if (g.status === "suspensa") row.suspensa += 1;
    byDomain.set(g.domain, row);
  }

  return [...byDomain.values()];
}
