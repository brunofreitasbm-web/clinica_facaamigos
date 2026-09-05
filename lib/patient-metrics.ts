import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";

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

export type AbaSessionPoint = {
  date: string;
  totalTrials: number;
  correctIndependent: number;
  withPrompt: number;
  incorrect: number;
};

export type ProgramLearningCurve = {
  id: string;
  programName: string;
  domain: string;
  masteryCriterion: string;
  status: "em_aquisicao" | "dominado" | "nao_iniciado";
  sessions: AbaSessionPoint[];
};

/**
 * Curva de aprendizado por programa, com granularidade de sessão (uma sessão
 * = um appointment), pra alimentar o gráfico de coleta ABA do prontuário.
 * Diferente de `getPatientProgramTrends` (que agrega por semana, pra um
 * dashboard geral), aqui cada ponto do gráfico é uma sessão real, com os 3
 * baldes de resultado (`correto`/`ajuda`/`incorreto`) separados — é o que a
 * tela de coleta (`trial-data-actions.ts`) grava por tentativa.
 */
export async function getPatientAbaLearningCurves(
  supabase: SupabaseClient<Database>,
  patientId: string,
  maxPrograms = 6,
): Promise<ProgramLearningCurve[]> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at")
    .eq("patient_id", patientId);

  const appointmentsList = appointments ?? [];
  if (appointmentsList.length === 0) return [];
  const startsAtByAppointment = new Map(appointmentsList.map((a) => [a.id, a.starts_at]));
  const appointmentIds = appointmentsList.map((a) => a.id);

  const { data: trials } = await supabase
    .from("trial_data")
    .select("program_id, appointment_id, result")
    .in("appointment_id", appointmentIds)
    .neq("result", "nao_aplicado");

  if (!trials?.length) return [];

  const programIds = [...new Set(trials.map((t) => t.program_id))];
  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, mastery_criterion, plan_goal_id")
    .in("id", programIds);

  const planGoalIds = [...new Set((programs ?? []).map((p) => p.plan_goal_id))];
  const { data: goals } = planGoalIds.length
    ? await supabase.from("plan_goals").select("id, domain").in("id", planGoalIds)
    : { data: [] as { id: string; domain: string }[] };

  const domainByPlanGoalId = new Map((goals ?? []).map((g) => [g.id, g.domain]));
  const programById = new Map((programs ?? []).map((p) => [p.id, p]));

  type Bucket = { correct: number; prompt: number; incorrect: number; total: number };
  const byProgram = new Map<string, Map<string, Bucket>>();
  for (const t of trials) {
    const bySession = byProgram.get(t.program_id) ?? new Map<string, Bucket>();
    const bucket = bySession.get(t.appointment_id) ?? { correct: 0, prompt: 0, incorrect: 0, total: 0 };
    if (t.result === "correto") bucket.correct += 1;
    else if (t.result === "ajuda") bucket.prompt += 1;
    else if (t.result === "incorreto") bucket.incorrect += 1;
    bucket.total += 1;
    bySession.set(t.appointment_id, bucket);
    byProgram.set(t.program_id, bySession);
  }

  const ranked = [...byProgram.entries()]
    .sort((a, b) => {
      const totalA = [...a[1].values()].reduce((sum, v) => sum + v.total, 0);
      const totalB = [...b[1].values()].reduce((sum, v) => sum + v.total, 0);
      return totalB - totalA;
    })
    .slice(0, maxPrograms);

  return ranked.map(([programId, bySession]) => {
    const program = programById.get(programId);
    const domain = program ? (domainByPlanGoalId.get(program.plan_goal_id) ?? "outro") : "outro";

    const sessions: AbaSessionPoint[] = [...bySession.entries()]
      .map(([appointmentId, bucket]) => ({ startsAt: startsAtByAppointment.get(appointmentId) ?? "", bucket }))
      .filter((s) => s.startsAt)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(({ startsAt, bucket }) => ({
        date: new Date(startsAt).toLocaleDateString("pt-BR", {
          timeZone: CLINIC_TIMEZONE,
          day: "2-digit",
          month: "2-digit",
        }),
        totalTrials: bucket.total,
        correctIndependent: bucket.correct,
        withPrompt: bucket.prompt,
        incorrect: bucket.incorrect,
      }));

    // Heurística de "dominado": `mastery_criterion` é texto livre redigido
    // pelo supervisor (ex. "≥ 80% acertos independentes em 3 sessões
    // consecutivas") — não dá pra parsear critério arbitrário com segurança,
    // então usamos média das últimas 2 sessões ≥ 80% independente como
    // aproximação prática; o texto do critério real aparece ao lado pra
    // quem decide clinicamente se o programa está de fato dominado.
    const lastTwo = sessions.slice(-2);
    const lastTwoPct =
      lastTwo.length > 0
        ? lastTwo.reduce((sum, s) => sum + s.correctIndependent / Math.max(s.totalTrials, 1), 0) / lastTwo.length
        : 0;
    const status: ProgramLearningCurve["status"] =
      sessions.length === 0 ? "nao_iniciado" : lastTwoPct >= 0.8 ? "dominado" : "em_aquisicao";

    return {
      id: programId,
      programName: program?.name ?? "Programa",
      domain,
      masteryCriterion: program?.mastery_criterion ?? "Critério não definido",
      status,
      sessions,
    };
  });
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
