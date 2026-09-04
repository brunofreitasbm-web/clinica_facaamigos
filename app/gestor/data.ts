import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { countOverdueSessionNotes } from "@/lib/session-note-pending";

type Supa = SupabaseClient<Database>;

// ── Utilidades de período ────────────────────────────────────────────────
// Mês corrente em UTC — mesma simplificação usada no resto do app (nenhuma
// tela existente normaliza mês/competência por CLINIC_TIMEZONE ainda).
export function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startISO: start.toISOString(), endISO: end.toISOString(), competenceMonth: start.toISOString().slice(0, 10) };
}

export function hoursBetween(startsAt: string, endsAt: string) {
  return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
}

/**
 * Preço médio de sessão da clínica — usado só para estimar o impacto em R$
 * dos vazamentos (§1/§10) quando não há como calcular o valor exato da
 * sessão específica (ex.: falta não tem billing_item). Aproximação
 * deliberada: média das linhas vigentes de `insurer_price_tables` da
 * clínica; sem nenhuma tabela vigente, cai pra média de `billing_items`
 * pagos recentes; sem nenhum dos dois, retorna null (a UI mostra "sem dado"
 * em vez de inventar um número).
 */
export async function getAverageSessionPrice(supabase: Supa, clinicId: string): Promise<number | null> {
  const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  if (insurerIds.length > 0) {
    const { data: prices } = await supabase
      .from("insurer_price_tables")
      .select("price")
      .in("insurer_id", insurerIds)
      .is("valid_to", null);
    if (prices && prices.length > 0) {
      return prices.reduce((sum, p) => sum + Number(p.price), 0) / prices.length;
    }
  }
  const { data: items } = await supabase
    .from("billing_items")
    .select("amount")
    .eq("status", "pago")
    .limit(50);
  if (items && items.length > 0) {
    return items.reduce((sum, i) => sum + Number(i.amount), 0) / items.length;
  }
  return null;
}

/** Sessões `realizada` por paciente — usado pra checar recuperação de falta (janela de 7 dias, §10.1 `recovery_rate`). */
export async function fetchRealizedStartsByPatient(supabase: Supa, patientIds: string[]) {
  const map = new Map<string, string[]>();
  if (patientIds.length === 0) return map;
  const { data } = await supabase
    .from("appointments")
    .select("patient_id, starts_at")
    .eq("status", "realizada")
    .in("patient_id", patientIds);
  for (const row of data ?? []) {
    const arr = map.get(row.patient_id) ?? [];
    arr.push(row.starts_at);
    map.set(row.patient_id, arr);
  }
  return map;
}

export function wasRecoveredWithinWeek(faltaStartsAt: string, realizedStarts: string[]): boolean {
  const faltaTime = new Date(faltaStartsAt).getTime();
  const weekLater = faltaTime + 7 * 24 * 60 * 60 * 1000;
  return realizedStarts.some((ts) => {
    const t = new Date(ts).getTime();
    return t > faltaTime && t <= weekLater;
  });
}

async function namesByProfileId(supabase: Supa, ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  for (const p of data ?? []) map.set(p.id, p.full_name);
  return map;
}

function topBreakdown(counts: Map<string, number>, limit = 6): LeakBreakdownItem[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type LeakBreakdownItem = { label: string; count: number };

export type LeakCard = {
  key: string;
  kicker: string;
  title: string;
  value: number;
  valueSuffix?: string;
  amountLabel: string;
  /** Valor em R$ do amountLabel quando estimável — usado só pra somar "vazamento total"; null quando o card não tem estimativa monetária confiável. */
  amountValue: number | null;
  metaLabel: string;
  breakdownLabel: string;
  breakdown: LeakBreakdownItem[];
  note: string;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ── Vazamento 1: faltas sem recuperação (§10.1 recovery_rate) ───────────
async function buildFaltaLeak(supabase: Supa, clinicId: string, avgPrice: number | null): Promise<LeakCard> {
  const { startISO, endISO } = currentMonthRange();
  const { data } = await supabase
    .from("appointments")
    .select("id, patient_id, therapist_id, starts_at, patients!inner(clinic_id)")
    .eq("status", "falta_familia")
    .eq("patients.clinic_id", clinicId)
    .gte("starts_at", startISO)
    .lt("starts_at", endISO);
  const faltas = data ?? [];

  const realizedByPatient = await fetchRealizedStartsByPatient(
    supabase,
    [...new Set(faltas.map((f) => f.patient_id))],
  );
  const therapistNames = await namesByProfileId(supabase, [...new Set(faltas.map((f) => f.therapist_id))]);

  const byTherapist = new Map<string, number>();
  let unrecovered = 0;
  for (const f of faltas) {
    const recovered = wasRecoveredWithinWeek(f.starts_at, realizedByPatient.get(f.patient_id) ?? []);
    if (!recovered) {
      unrecovered += 1;
      const name = therapistNames.get(f.therapist_id) ?? "Sem terapeuta";
      byTherapist.set(name, (byTherapist.get(name) ?? 0) + 1);
    }
  }

  const recoveredCount = faltas.length - unrecovered;
  const recoveryRatePct = faltas.length > 0 ? Math.round((recoveredCount / faltas.length) * 100) : null;

  return {
    key: "faltas",
    kicker: "Vazamento 1",
    title: "Faltas sem recuperação",
    value: unrecovered,
    amountLabel: avgPrice != null ? `${currency.format(unrecovered * avgPrice)} estimado` : "impacto não estimado",
    amountValue: avgPrice != null ? unrecovered * avgPrice : null,
    metaLabel:
      recoveryRatePct != null
        ? `meta: recuperar ≥ 40% das faltas em 7 dias · realizado ${recoveryRatePct}%`
        : "meta: recuperar ≥ 40% das faltas em 7 dias",
    breakdownLabel: "por terapeuta",
    breakdown: topBreakdown(byTherapist),
    note: `${faltas.length} falta(s) de família neste mês, ${unrecovered} sem uma sessão de reposição realizada em até 7 dias.`,
  };
}

// ── Vazamento 2: sessões sem guia vigente (§10.1/10.4 no_auth_sessions) ─
async function buildNoAuthLeak(supabase: Supa, clinicId: string, avgPrice: number | null): Promise<LeakCard> {
  const { startISO, endISO } = currentMonthRange();
  const { data } = await supabase
    .from("appointments")
    .select("id, patient_id, patients!inner(clinic_id)")
    .eq("status", "realizada")
    .eq("is_provisional", true)
    .eq("patients.clinic_id", clinicId)
    .gte("starts_at", startISO)
    .lt("starts_at", endISO);
  const rows = data ?? [];

  const patientIds = [...new Set(rows.map((r) => r.patient_id))];
  const byInsurer = new Map<string, number>();
  if (patientIds.length > 0) {
    const { data: pi } = await supabase
      .from("patient_insurance")
      .select("patient_id, is_private, insurers(name)")
      .in("patient_id", patientIds);
    const insurerByPatient = new Map<string, string>();
    for (const row of pi ?? []) {
      if (insurerByPatient.has(row.patient_id)) continue;
      const insurerName = Array.isArray(row.insurers) ? row.insurers[0]?.name : row.insurers?.name;
      insurerByPatient.set(row.patient_id, row.is_private ? "Particular" : (insurerName ?? "Convênio"));
    }
    for (const r of rows) {
      const name = insurerByPatient.get(r.patient_id) ?? "Sem convênio vinculado";
      byInsurer.set(name, (byInsurer.get(name) ?? 0) + 1);
    }
  }

  return {
    key: "sem-guia",
    kicker: "Vazamento 2",
    title: "Sessões sem guia vigente",
    value: rows.length,
    amountLabel: avgPrice != null ? `${currency.format(rows.length * avgPrice)} em risco` : "impacto não estimado",
    amountValue: avgPrice != null ? rows.length * avgPrice : null,
    metaLabel: "meta: 0 sessões sem guia vigente (eliminatório)",
    breakdownLabel: "por convênio",
    breakdown: topBreakdown(byInsurer),
    note: `${rows.length} sessão(ões) realizada(s) neste mês como provisória (sem authorization_id) — cada uma é risco de glosa integral.`,
  };
}

// ── Vazamento 3: evoluções atrasadas >24h (§10.3 note_24h_rate) ─────────
async function buildOverdueNotesLeak(supabase: Supa, clinicId: string): Promise<LeakCard> {
  const cutoffISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates } = await supabase
    .from("appointments")
    .select("id, therapist_id, patients!inner(clinic_id)")
    .eq("status", "realizada")
    .eq("patients.clinic_id", clinicId)
    .lte("starts_at", cutoffISO);
  const list = candidates ?? [];

  const pendingByTherapist = new Map<string, string>();
  if (list.length > 0) {
    const { data: notes } = await supabase
      .from("session_notes")
      .select("appointment_id")
      .in(
        "appointment_id",
        list.map((c) => c.id),
      );
    const withNote = new Set((notes ?? []).map((n) => n.appointment_id));
    const pending = list.filter((c) => !withNote.has(c.id));
    const names = await namesByProfileId(supabase, [...new Set(pending.map((p) => p.therapist_id))]);
    for (const p of pending) pendingByTherapist.set(p.id, names.get(p.therapist_id) ?? "Sem terapeuta");
  }

  const byTherapist = new Map<string, number>();
  for (const name of pendingByTherapist.values()) byTherapist.set(name, (byTherapist.get(name) ?? 0) + 1);

  // Total oficial reaproveita a mesma regra de negócio de lib/session-note-pending.ts
  // (RPC session_note_pending) em vez de confiar só no cálculo em lote acima.
  const officialTotal = await countOverdueSessionNotes(supabase, 24);

  return {
    key: "evolucao-atrasada",
    kicker: "Vazamento 3",
    title: "Evoluções atrasadas > 24h",
    value: officialTotal,
    amountLabel: "risco de glosa por documentação",
    amountValue: null,
    metaLabel: "meta: ≥ 98% das evoluções em até 24h (≤ 2% atrasadas)",
    breakdownLabel: "por terapeuta",
    breakdown: topBreakdown(byTherapist),
    note: `${officialTotal} sessão(ões) realizada(s) há mais de 24h ainda sem session_notes registrada.`,
  };
}

// ── Vazamento 4: evasão silenciosa (§10.2 churn_rate) ───────────────────
async function buildSilentChurnLeak(supabase: Supa, clinicId: string): Promise<LeakCard> {
  const { data: patients } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("status", "ativo");
  const list = patients ?? [];
  if (list.length === 0) {
    return {
      key: "evasao",
      kicker: "Vazamento 4",
      title: "Evasão silenciosa",
      value: 0,
      amountLabel: "impacto não estimado",
      amountValue: null,
      metaLabel: "meta: ≤ 3% da base ativa por mês",
      breakdownLabel: "por terapeuta",
      breakdown: [],
      note: "Nenhum paciente ativo para avaliar.",
    };
  }

  const ids = list.map((p) => p.id);
  const { data: lastSessions } = await supabase
    .from("appointments")
    .select("patient_id, starts_at")
    .in("patient_id", ids)
    .eq("status", "realizada")
    .order("starts_at", { ascending: false });
  const lastByPatient = new Map<string, string>();
  for (const s of lastSessions ?? []) {
    if (!lastByPatient.has(s.patient_id)) lastByPatient.set(s.patient_id, s.starts_at);
  }

  const cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const silentIds = ids.filter((id) => {
    const last = lastByPatient.get(id);
    return !last || new Date(last).getTime() < cutoff;
  });

  const byTherapist = new Map<string, number>();
  if (silentIds.length > 0) {
    const { data: access } = await supabase
      .from("patient_access")
      .select("patient_id, profile_id, profiles!profile_id(full_name)")
      .in("patient_id", silentIds)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null);
    const therapistByPatient = new Map<string, string>();
    for (const a of access ?? []) {
      if (therapistByPatient.has(a.patient_id)) continue;
      const name = Array.isArray(a.profiles) ? a.profiles[0]?.full_name : a.profiles?.full_name;
      therapistByPatient.set(a.patient_id, name ?? "Sem terapeuta");
    }
    for (const id of silentIds) {
      const name = therapistByPatient.get(id) ?? "Sem terapeuta";
      byTherapist.set(name, (byTherapist.get(name) ?? 0) + 1);
    }
  }

  const ratePct = Math.round((silentIds.length / list.length) * 100);

  return {
    key: "evasao",
    kicker: "Vazamento 4",
    title: "Evasão silenciosa",
    value: silentIds.length,
    amountLabel: "impacto não estimado",
    amountValue: null,
    metaLabel: `meta: ≤ 3% da base ativa por mês · realizado ${ratePct}%`,
    breakdownLabel: "por terapeuta",
    breakdown: topBreakdown(byTherapist),
    note: `${silentIds.length} de ${list.length} pacientes ativos sem sessão realizada nos últimos 21 dias (sem alta/evadido registrado).`,
  };
}

export async function getLeakCards(supabase: Supa, clinicId: string): Promise<LeakCard[]> {
  const avgPrice = await getAverageSessionPrice(supabase, clinicId);
  const [faltas, semGuia, evolucao, evasao] = await Promise.all([
    buildFaltaLeak(supabase, clinicId, avgPrice),
    buildNoAuthLeak(supabase, clinicId, avgPrice),
    buildOverdueNotesLeak(supabase, clinicId),
    buildSilentChurnLeak(supabase, clinicId),
  ]);
  return [faltas, semGuia, evolucao, evasao];
}

// ── Bonificação por cargo (§10.1/10.2/10.4) ──────────────────────────────
// Cálculo ao vivo, aproximado: `targets`/`metric_snapshots` (§10.6) ainda
// não têm linha nenhuma nesta clínica (pg_cron de fechamento mensal é
// trabalho futuro), então em vez de ler uma view fechada, recomputamos as 3
// métricas mais representativas de cada cargo direto de `appointments`/
// `billing_items` para o mês corrente. Pesos e demais métricas de cada
// cargo (§10.1/10.2/10.4 completos) ficam para quando a view SQL existir.
export type BonusRow = {
  role: string;
  metricLabel: string;
  actualLabel: string;
  progressPct: number;
  status: "atingida" | "perto" | "abaixo";
};

function evalTarget(actual: number | null, target: number, direction: "max" | "min") {
  if (actual == null) return { status: "abaixo" as const, progressPct: 0 };
  if (direction === "max") {
    const progressPct = Math.min(100, Math.round((target / Math.max(actual, 0.0001)) * 100));
    if (actual <= target) return { status: "atingida" as const, progressPct };
    if (actual <= target * 1.25) return { status: "perto" as const, progressPct };
    return { status: "abaixo" as const, progressPct };
  }
  const progressPct = Math.min(100, Math.round((actual / target) * 100));
  if (actual >= target) return { status: "atingida" as const, progressPct };
  if (actual >= target * 0.8) return { status: "perto" as const, progressPct };
  return { status: "abaixo" as const, progressPct };
}

export async function getBonusRows(supabase: Supa, clinicId: string): Promise<BonusRow[]> {
  const { startISO, endISO } = currentMonthRange();
  const { data: monthAppointments } = await supabase
    .from("appointments")
    .select("status, starts_at, ends_at, patients!inner(clinic_id)")
    .eq("patients.clinic_id", clinicId)
    .gte("starts_at", startISO)
    .lt("starts_at", endISO);
  const list = monthAppointments ?? [];
  const consideredStatuses = ["realizada", "falta_familia", "cancelada_familia", "cancelada_terapeuta", "cancelada_clinica"];
  const denom = list.filter((a) => consideredStatuses.includes(a.status));

  const noShowRate = denom.length > 0 ? denom.filter((a) => a.status === "falta_familia").length / denom.length : null;

  const scheduledHours = denom.reduce((sum, a) => sum + hoursBetween(a.starts_at, a.ends_at), 0);
  const realizedHours = denom
    .filter((a) => a.status === "realizada")
    .reduce((sum, a) => sum + hoursBetween(a.starts_at, a.ends_at), 0);
  const occupancyRate = scheduledHours > 0 ? realizedHours / scheduledHours : null;

  let glosaRate: number | null = null;
  const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  if (insurerIds.length > 0) {
    const { data: periods } = await supabase.from("billing_periods").select("id").in("insurer_id", insurerIds);
    const periodIds = (periods ?? []).map((p) => p.id);
    if (periodIds.length > 0) {
      const { data: items } = await supabase.from("billing_items").select("amount, status").in("billing_period_id", periodIds);
      const total = (items ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
      const glosado = (items ?? []).filter((i) => i.status === "glosado").reduce((sum, i) => sum + Number(i.amount), 0);
      glosaRate = total > 0 ? glosado / total : null;
    }
  }

  const noShow = evalTarget(noShowRate, 0.08, "max");
  const occupancy = evalTarget(occupancyRate, 0.85, "min");
  const glosa = evalTarget(glosaRate, 0.04, "max");

  return [
    {
      role: "Recepção",
      metricLabel: "No-show ≤ 8%",
      actualLabel: noShowRate != null ? `${(noShowRate * 100).toFixed(1)}%` : "sem sessões no mês",
      ...noShow,
    },
    {
      role: "Coordenação clínica",
      metricLabel: "Ocupação (horas agendadas) ≥ 85%",
      actualLabel: occupancyRate != null ? `${(occupancyRate * 100).toFixed(1)}%` : "sem sessões no mês",
      ...occupancy,
    },
    {
      role: "Faturamento",
      metricLabel: "Glosa ≤ 4% do faturado",
      actualLabel: glosaRate != null ? `${(glosaRate * 100).toFixed(1)}%` : "sem competência aberta",
      ...glosa,
    },
  ];
}

// ── Terapeutas · progressão de faixa (§10.3) ─────────────────────────────
export type TierRow = {
  id: string;
  name: string;
  tier: string;
  sessions: number;
  note24hRateLabel: string;
  faltasRecuperadasLabel: string;
  nextTierLabel: string;
};

export async function getTierProgression(supabase: Supa, clinicId: string): Promise<TierRow[]> {
  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "terapeuta")
    .eq("active", true)
    .order("full_name");
  const list = therapists ?? [];
  if (list.length === 0) return [];
  const ids = list.map((t) => t.id);

  const { data: contracts } = await supabase
    .from("therapist_contracts")
    .select("profile_id, tier, valid_from, valid_to")
    .in("profile_id", ids);
  const now = Date.now();
  const tierByTherapist = new Map<string, string>();
  for (const c of contracts ?? []) {
    const from = new Date(c.valid_from).getTime();
    const to = c.valid_to ? new Date(c.valid_to).getTime() : null;
    if (from <= now && (to == null || to >= now)) tierByTherapist.set(c.profile_id, c.tier);
  }

  const ninetyDaysAgoISO = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("appointments")
    .select("id, therapist_id, patient_id, status, starts_at, ends_at")
    .in("therapist_id", ids)
    .gte("starts_at", ninetyDaysAgoISO);
  const sessionList = sessions ?? [];

  const realizedIds = sessionList.filter((s) => s.status === "realizada").map((s) => s.id);
  const noteByAppointment = new Map<string, string>();
  if (realizedIds.length > 0) {
    const { data: notes } = await supabase
      .from("session_notes")
      .select("appointment_id, created_at_server")
      .in("appointment_id", realizedIds);
    for (const n of notes ?? []) {
      const existing = noteByAppointment.get(n.appointment_id);
      if (!existing || new Date(n.created_at_server) < new Date(existing)) {
        noteByAppointment.set(n.appointment_id, n.created_at_server);
      }
    }
  }

  const faltaPatientIds = [...new Set(sessionList.filter((s) => s.status === "falta_familia").map((s) => s.patient_id))];
  const realizedByPatient = await fetchRealizedStartsByPatient(supabase, faltaPatientIds);

  return list.map((t) => {
    const mine = sessionList.filter((s) => s.therapist_id === t.id);
    const realized = mine.filter((s) => s.status === "realizada");
    const faltas = mine.filter((s) => s.status === "falta_familia");

    let onTime = 0;
    for (const s of realized) {
      const noteAt = noteByAppointment.get(s.id);
      if (noteAt && new Date(noteAt).getTime() <= new Date(s.ends_at).getTime() + 24 * 60 * 60 * 1000) onTime += 1;
    }
    const note24hRate = realized.length > 0 ? onTime / realized.length : null;

    let recovered = 0;
    for (const f of faltas) {
      if (wasRecoveredWithinWeek(f.starts_at, realizedByPatient.get(f.patient_id) ?? [])) recovered += 1;
    }
    const recoveryRate = faltas.length > 0 ? recovered / faltas.length : null;

    const eligible = note24hRate != null && note24hRate >= 0.98 && realized.length >= 10;

    return {
      id: t.id,
      name: t.full_name,
      tier: tierByTherapist.get(t.id) ?? "sem contrato vigente",
      sessions: realized.length,
      note24hRateLabel: note24hRate != null ? `${Math.round(note24hRate * 100)}%` : "sem sessões",
      faltasRecuperadasLabel:
        faltas.length > 0 ? `${recovered}/${faltas.length} (${Math.round((recoveryRate ?? 0) * 100)}%)` : "sem faltas",
      nextTierLabel: eligible ? "Elegível — proposta ao gestor" : "Mantém faixa atual",
    };
  });
}
