import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { hourInTimeZone, weekdayInTimeZone, civilDateInTimeZone } from "@/lib/timezone";
import { GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";
import { findMetricDef, formatMetricValue, type MetricDirection } from "@/lib/metric-catalog";

type Supa = SupabaseClient<Database>;

type AppointmentRow = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  therapist_id: string;
  cancelled_at: string | null;
};

// ── QUADRO: Mapa de Calor Dia da Semana × Hora ──────────────────────────
// Identifica janelas ociosas (dia+hora com pouca ocupação) pra facilitar
// encaixe de novos pacientes. Horário civil da clínica (America/Sao_Paulo),
// não getHours()/getDay() do processo — que na Vercel roda em UTC.

export type HeatmapCell = { dow: number; hour: number; count: number; intensity: number; isIdle: boolean };
export type WeekHourHeatmap = {
  dayLabels: { dow: number; label: string }[];
  hours: number[];
  cells: HeatmapCell[];
  maxCount: number;
  idleWindows: { dow: number; hour: number; label: string }[];
};

const DOW_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HEATMAP_HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08..18
const HEATMAP_DOWS = [1, 2, 3, 4, 5, 6]; // Seg..Sáb (clínica não atende domingo)

export function buildWeekHourHeatmap(appointments: AppointmentRow[]): WeekHourHeatmap {
  const counts = new Map<string, number>();
  const relevant = appointments.filter((a) => !GRID_EXCLUDED_STATUSES.includes(a.status));

  for (const app of relevant) {
    const dow = weekdayInTimeZone(app.starts_at, CLINIC_TIMEZONE);
    const hour = hourInTimeZone(app.starts_at, CLINIC_TIMEZONE);
    if (!HEATMAP_DOWS.includes(dow) || hour < 8 || hour > 18) continue;
    const key = `${dow}-${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let maxCount = 0;
  for (const c of counts.values()) maxCount = Math.max(maxCount, c);

  const cells: HeatmapCell[] = [];
  for (const dow of HEATMAP_DOWS) {
    for (const hour of HEATMAP_HOURS) {
      const count = counts.get(`${dow}-${hour}`) ?? 0;
      cells.push({
        dow,
        hour,
        count,
        intensity: maxCount > 0 ? count / maxCount : 0,
        isIdle: count === 0,
      });
    }
  }

  const idleWindows = cells
    .filter((c) => c.isIdle)
    .slice(0, 6)
    .map((c) => ({ dow: c.dow, hour: c.hour, label: `${DOW_LABEL[c.dow]} ${String(c.hour).padStart(2, "0")}h` }));

  return {
    dayLabels: HEATMAP_DOWS.map((dow) => ({ dow, label: DOW_LABEL[dow] })),
    hours: HEATMAP_HOURS,
    cells,
    maxCount,
    idleWindows,
  };
}

// ── QUADRO: Funil de Onboarding ──────────────────────────────────────────
// Cohort de eventos no período (contato → avaliação → guia → 1ª sessão),
// tempo médio entre etapas + pipeline atual travado (>=3 dias no mesmo
// estágio), reaproveitando a mesma regra de estágio de lib/patient-stage.ts.

export type FunnelStageKey = "interessado" | "avaliacao" | "guia" | "grade";
export type FunnelStage = {
  key: FunnelStageKey;
  label: string;
  count: number;
  avgDaysFromPrev: number | null;
  samples: number;
};

export type OnboardingFunnel = {
  stages: FunnelStage[];
  pipelineNow: {
    interessados: number;
    awaitingEvaluation: number;
    evaluatedNoGuide: number;
    authorizedNoGrid: number;
    stuck3d: number;
  };
};

type FunnelPatientRow = {
  id: string;
  status: string;
  created_at: string;
  first_contact_at: string | null;
  evaluated_at: string | null;
  first_session_at: string | null;
};

function avgDays(deltasMs: number[]): { avg: number | null; samples: number } {
  const valid = deltasMs.filter((d) => d >= 0);
  if (valid.length === 0) return { avg: null, samples: 0 };
  const avgMs = valid.reduce((s, d) => s + d, 0) / valid.length;
  return { avg: Math.round((avgMs / 86_400_000) * 10) / 10, samples: valid.length };
}

export async function getOnboardingFunnel(
  supabase: Supa,
  clinicId: string,
  startISO: string,
  endISO: string,
  allPatients: FunnelPatientRow[],
): Promise<OnboardingFunnel> {
  const patientIds = allPatients.map((p) => p.id);

  const { data: firstAuths } = patientIds.length
    ? await supabase
        .from("authorizations")
        .select("created_at, patient_insurance!inner(patient_id, patients!inner(clinic_id))")
        .eq("patient_insurance.patients.clinic_id", clinicId)
        .is("previous_authorization_id", null)
    : { data: [] as { created_at: string; patient_insurance: unknown }[] };

  const firstAuthAtByPatient = new Map<string, string>();
  for (const row of firstAuths ?? []) {
    const pi = row.patient_insurance as { patient_id: string } | { patient_id: string }[] | null;
    const patientId = Array.isArray(pi) ? pi[0]?.patient_id : pi?.patient_id;
    if (!patientId) continue;
    const existing = firstAuthAtByPatient.get(patientId);
    if (!existing || new Date(row.created_at) < new Date(existing)) {
      firstAuthAtByPatient.set(patientId, row.created_at);
    }
  }

  const inPeriod = (iso: string | null) => !!iso && iso >= startISO && iso < endISO;

  const interessadoCount = allPatients.filter((p) => p.created_at >= startISO && p.created_at < endISO).length;
  const avaliacaoCount = allPatients.filter((p) => inPeriod(p.evaluated_at)).length;
  const guiaPatients = allPatients.filter((p) => inPeriod(firstAuthAtByPatient.get(p.id) ?? null));
  const gradePatients = allPatients.filter((p) => inPeriod(p.first_session_at));

  const contactToEval = avgDays(
    allPatients
      .filter((p) => inPeriod(p.evaluated_at))
      .map((p) => new Date(p.evaluated_at!).getTime() - new Date(p.first_contact_at ?? p.created_at).getTime()),
  );
  const evalToGuia = avgDays(
    guiaPatients
      .filter((p) => p.evaluated_at)
      .map((p) => new Date(firstAuthAtByPatient.get(p.id)!).getTime() - new Date(p.evaluated_at!).getTime()),
  );
  const guiaToGrade = avgDays(
    gradePatients
      .filter((p) => firstAuthAtByPatient.has(p.id))
      .map((p) => new Date(p.first_session_at!).getTime() - new Date(firstAuthAtByPatient.get(p.id)!).getTime()),
  );

  const stages: FunnelStage[] = [
    { key: "interessado", label: "Interessados (novos)", count: interessadoCount, avgDaysFromPrev: null, samples: 0 },
    { key: "avaliacao", label: "Avaliados", count: avaliacaoCount, avgDaysFromPrev: contactToEval.avg, samples: contactToEval.samples },
    { key: "guia", label: "Guia autorizada", count: guiaPatients.length, avgDaysFromPrev: evalToGuia.avg, samples: evalToGuia.samples },
    { key: "grade", label: "Em grade (1ª sessão)", count: gradePatients.length, avgDaysFromPrev: guiaToGrade.avg, samples: guiaToGrade.samples },
  ];

  // Pipeline atual (situação de hoje, não do período filtrado)
  const now = Date.now();
  const activeAuthPatientIds = new Set(
    (
      await (patientIds.length
        ? supabase
            .from("authorizations")
            .select("patient_insurance!inner(patient_id, patients!inner(clinic_id))")
            .eq("patient_insurance.patients.clinic_id", clinicId)
            .eq("status", "ativa")
        : Promise.resolve({ data: [] as { patient_insurance: unknown }[] }))
    ).data?.flatMap((r) => {
      const pi = r.patient_insurance as { patient_id: string } | { patient_id: string }[] | null;
      if (!pi) return [];
      return Array.isArray(pi) ? pi.map((x) => x.patient_id) : [pi.patient_id];
    }) ?? [],
  );

  let interessados = 0;
  let awaitingEvaluation = 0;
  let evaluatedNoGuide = 0;
  let authorizedNoGrid = 0;
  let stuck3d = 0;

  for (const p of allPatients) {
    if (p.status === "ativo" || p.status === "alta" || p.status === "evadido" || p.first_session_at) continue;
    const hasAuth = activeAuthPatientIds.has(p.id);
    const daysSinceCreated = Math.floor((now - new Date(p.created_at).getTime()) / 86_400_000);

    if (hasAuth) authorizedNoGrid++;
    else if (p.evaluated_at) evaluatedNoGuide++;
    else if (p.status === "avaliacao") awaitingEvaluation++;
    else interessados++;

    if (daysSinceCreated >= 3) stuck3d++;
  }

  return {
    stages,
    pipelineNow: { interessados, awaitingEvaluation, evaluatedNoGuide, authorizedNoGrid, stuck3d },
  };
}

// ── QUADRO: Produtividade por Terapeuta ──────────────────────────────────
// Mesmas definições da apuração PLR (20260913200000_plr_human_effort_metrics.sql)
// pra números baterem com o fechamento mensal: cancelamento tardio pelo
// terapeuta (<24h antes do horário) e evolução em até 24h da sessão.

export type TherapistProductivityRow = {
  therapistId: string;
  name: string;
  realized: number;
  noShows: number;
  cancelledByTherapist: number;
  therapistCancelRatePct: number | null;
  realizedHours: number;
  availableHours: number | null;
  utilizationPct: number | null;
  note24hRatePct: number | null;
};

export type TeamProductivity = {
  rows: TherapistProductivityRow[];
  avgUtilizationPct: number | null;
  avgNote24hPct: number | null;
};

const DENOM_STATUSES = ["realizada", "falta_familia", "cancelada_familia", "cancelada_terapeuta", "cancelada_clinica"];

export async function getTeamProductivity(
  supabase: Supa,
  clinicId: string,
  appointments: AppointmentRow[],
  therapists: { id: string; full_name: string }[],
  startISO: string,
  endISO: string,
): Promise<TeamProductivity> {
  if (therapists.length === 0) {
    return { rows: [], avgUtilizationPct: null, avgNote24hPct: null };
  }

  const realizedIds = appointments.filter((a) => a.status === "realizada").map((a) => a.id);
  const noteByAppointment = new Map<string, string>();
  for (let i = 0; i < realizedIds.length; i += 200) {
    const chunk = realizedIds.slice(i, i + 200);
    const { data: notes } = await supabase
      .from("session_notes")
      .select("appointment_id, created_at_server")
      .in("appointment_id", chunk);
    for (const n of notes ?? []) {
      const existing = noteByAppointment.get(n.appointment_id);
      if (!existing || new Date(n.created_at_server) < new Date(existing)) {
        noteByAppointment.set(n.appointment_id, n.created_at_server);
      }
    }
  }

  const { data: availabilityRows } = await supabase
    .from("professional_availability")
    .select("profile_id, day_of_week, start_time, end_time")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .in("profile_id", therapists.map((t) => t.id));

  // Dias úteis civis do período, por dia da semana (pra multiplicar as janelas de disponibilidade)
  const weekdayOccurrences = new Map<number, number>();
  const startDate = civilDateInTimeZone(new Date(startISO), CLINIC_TIMEZONE);
  const endDate = civilDateInTimeZone(new Date(endISO), CLINIC_TIMEZONE);
  if (startDate && endDate) {
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cursor < end) {
      const dow = cursor.getUTCDay();
      weekdayOccurrences.set(dow, (weekdayOccurrences.get(dow) ?? 0) + 1);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  function timeToHours(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h + (m ?? 0) / 60;
  }

  const availableHoursByTherapist = new Map<string, number>();
  const hasAvailabilityRows = new Set<string>();
  for (const row of availabilityRows ?? []) {
    hasAvailabilityRows.add(row.profile_id);
    const occurrences = weekdayOccurrences.get(row.day_of_week) ?? 0;
    const dailyHours = Math.max(0, timeToHours(row.end_time) - timeToHours(row.start_time));
    availableHoursByTherapist.set(
      row.profile_id,
      (availableHoursByTherapist.get(row.profile_id) ?? 0) + dailyHours * occurrences,
    );
  }

  const rows: TherapistProductivityRow[] = therapists.map((t) => {
    const mine = appointments.filter((a) => a.therapist_id === t.id);
    const denom = mine.filter((a) => DENOM_STATUSES.includes(a.status));
    const realized = mine.filter((a) => a.status === "realizada");
    const noShows = mine.filter((a) => a.status === "falta_familia").length;

    let lateCancelled = 0;
    const cancelledByTherapist = mine.filter((a) => a.status === "cancelada_terapeuta").length;
    for (const a of mine) {
      if (a.status !== "cancelada_terapeuta" || !a.cancelled_at) continue;
      const hoursNotice = (new Date(a.starts_at).getTime() - new Date(a.cancelled_at).getTime()) / 3_600_000;
      if (hoursNotice < 24) lateCancelled++;
    }
    const therapistCancelRatePct = denom.length > 0 ? Math.round((lateCancelled / denom.length) * 1000) / 10 : null;

    const realizedHours = realized.reduce(
      (sum, a) => sum + (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 3_600_000,
      0,
    );

    const availableHours = hasAvailabilityRows.has(t.id) ? availableHoursByTherapist.get(t.id) ?? 0 : null;
    const utilizationPct =
      availableHours != null && availableHours > 0
        ? Math.round((realizedHours / availableHours) * 1000) / 10
        : null;

    let onTime = 0;
    for (const a of realized) {
      const noteAt = noteByAppointment.get(a.id);
      if (noteAt && new Date(noteAt).getTime() <= new Date(a.ends_at).getTime() + 24 * 3_600_000) onTime++;
    }
    const note24hRatePct = realized.length > 0 ? Math.round((onTime / realized.length) * 1000) / 10 : null;

    return {
      therapistId: t.id,
      name: t.full_name,
      realized: realized.length,
      noShows,
      cancelledByTherapist,
      therapistCancelRatePct,
      realizedHours: Math.round(realizedHours * 10) / 10,
      availableHours: availableHours != null ? Math.round(availableHours * 10) / 10 : null,
      utilizationPct,
      note24hRatePct,
    };
  });

  rows.sort((a, b) => b.realized - a.realized);

  const utilValues = rows.map((r) => r.utilizationPct).filter((v): v is number => v != null);
  const noteValues = rows.map((r) => r.note24hRatePct).filter((v): v is number => v != null);

  return {
    rows,
    avgUtilizationPct: utilValues.length > 0 ? Math.round((utilValues.reduce((s, v) => s + v, 0) / utilValues.length) * 10) / 10 : null,
    avgNote24hPct: noteValues.length > 0 ? Math.round((noteValues.reduce((s, v) => s + v, 0) / noteValues.length) * 10) / 10 : null,
  };
}

// ── QUADRO: Metas PLR vs Realizado (últimos 6 meses) ────────────────────
// Lê metric_snapshots (fechamento mensal oficial, scope_type='clinica') x
// targets cadastradas — única fonte auditável fechada por período do
// sistema. Sem linha até o job close_monthly_metric_snapshots rodar.

export type PlrTrendPoint = { periodStart: string; periodLabel: string; value: number | null; met: boolean | null };
export type PlrTrendRow = {
  role: string;
  metricKey: string;
  metricLabel: string;
  unit: "pct" | "dias" | "min" | "score";
  direction: MetricDirection;
  targetValue: number;
  points: PlrTrendPoint[];
};
export type PlrTrend = { months: { periodStart: string; label: string }[]; rows: PlrTrendRow[] };

const ROLE_LABEL: Record<string, string> = {
  recepcao: "Recepção",
  supervisor: "Coordenação",
  terapeuta: "Terapeutas",
  faturamento: "Faturamento",
};

function evaluateDirection(actual: number, targetFraction: number, direction: MetricDirection): boolean {
  return direction === "max" ? actual <= targetFraction : actual >= targetFraction;
}

export async function getPlrTrend(supabase: Supa, clinicId: string, months = 6): Promise<PlrTrend> {
  const { data: targets } = await supabase.from("targets").select("role, metric_key, target_value").eq("clinic_id", clinicId);
  const targetRows = targets ?? [];
  if (targetRows.length === 0) return { months: [], rows: [] };

  const now = new Date();
  const monthList: { periodStart: string; label: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthList.push({
      periodStart: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", ""),
    });
  }
  const sinceISO = monthList[0]!.periodStart;

  const metricKeys = [...new Set(targetRows.map((t) => t.metric_key))];
  const { data: snapshots } = await supabase
    .from("metric_snapshots")
    .select("metric_key, period_start, value")
    .eq("scope_type", "clinica")
    .eq("scope_id", clinicId)
    .in("metric_key", metricKeys)
    .gte("period_start", sinceISO);

  const valueByKeyAndMonth = new Map<string, number>();
  for (const s of snapshots ?? []) {
    valueByKeyAndMonth.set(`${s.metric_key}|${s.period_start.slice(0, 7)}`, Number(s.value));
  }

  const rows: PlrTrendRow[] = targetRows.map((t) => {
    const def = findMetricDef(t.role, t.metric_key);
    const unit = def?.unit ?? "pct";
    const direction = def?.direction ?? "min";
    const targetFraction = unit === "pct" ? t.target_value / 100 : t.target_value;

    const points: PlrTrendPoint[] = monthList.map((m) => {
      const value = valueByKeyAndMonth.get(`${t.metric_key}|${m.periodStart.slice(0, 7)}`) ?? null;
      return {
        periodStart: m.periodStart,
        periodLabel: m.label,
        value,
        met: value != null ? evaluateDirection(value, targetFraction, direction) : null,
      };
    });

    return {
      role: ROLE_LABEL[t.role] ?? t.role,
      metricKey: t.metric_key,
      metricLabel: def?.label ?? t.metric_key,
      unit,
      direction,
      targetValue: t.target_value,
      points,
    };
  });

  // Uma linha por (role, metric_key); se houver duplicatas (metas de vários
  // ciclos ativas ao mesmo tempo), mantém só a primeira.
  const seen = new Set<string>();
  const dedupedRows = rows.filter((r) => {
    const key = `${r.role}|${r.metricKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { months: monthList, rows: dedupedRows };
}

export { formatMetricValue };

// ── QUADRO: Concentração por Convênio ────────────────────────────────────
// % da receita nos top 3 convênios + ticket médio por sessão. Convênio-only
// (billing_items não cobre particular) — sinalizado na UI.

export type InsurerConcentrationRow = {
  insurerId: string;
  insurerName: string;
  revenue: number;
  glosado: number;
  sessions: number;
  ticketMedio: number | null;
  sharePct: number;
};

export type InsurerConcentration = {
  rows: InsurerConcentrationRow[];
  total: number;
  top3SharePct: number;
  riskLevel: "baixa" | "media" | "alta";
};

export function buildInsurerConcentration(
  billingItems: {
    id: string;
    amount: number;
    status: string;
    appointment_id: string;
    billing_periods: { insurer_id: string; insurers?: { id: string; name: string } | { id: string; name: string }[] | null } | { insurer_id: string; insurers?: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  }[],
): InsurerConcentration {
  type Acc = { name: string; revenue: number; glosado: number; sessions: Set<string> };
  const byInsurer = new Map<string, Acc>();

  for (const item of billingItems) {
    const bp = Array.isArray(item.billing_periods) ? item.billing_periods[0] : item.billing_periods;
    if (!bp) continue;
    const insObj = Array.isArray(bp.insurers) ? bp.insurers[0] : bp.insurers;
    const insurerId = bp.insurer_id;
    const insurerName = insObj?.name ?? "Convênio";

    const acc = byInsurer.get(insurerId) ?? { name: insurerName, revenue: 0, glosado: 0, sessions: new Set<string>() };
    const val = Number(item.amount || 0);
    if (item.status === "glosado") {
      acc.glosado += val;
    } else {
      acc.revenue += val;
      acc.sessions.add(item.appointment_id);
    }
    byInsurer.set(insurerId, acc);
  }

  const total = [...byInsurer.values()].reduce((sum, a) => sum + a.revenue, 0);

  const rows: InsurerConcentrationRow[] = [...byInsurer.entries()]
    .map(([insurerId, acc]) => ({
      insurerId,
      insurerName: acc.name,
      revenue: acc.revenue,
      glosado: acc.glosado,
      sessions: acc.sessions.size,
      ticketMedio: acc.sessions.size > 0 ? Math.round((acc.revenue / acc.sessions.size) * 100) / 100 : null,
      sharePct: total > 0 ? Math.round((acc.revenue / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const top3SharePct = Math.round(rows.slice(0, 3).reduce((sum, r) => sum + r.sharePct, 0) * 10) / 10;
  const riskLevel: "baixa" | "media" | "alta" = top3SharePct >= 80 ? "alta" : top3SharePct >= 60 ? "media" : "baixa";

  return { rows, total, top3SharePct, riskLevel };
}
