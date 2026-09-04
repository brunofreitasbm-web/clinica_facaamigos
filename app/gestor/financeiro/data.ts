import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { currentMonthRange, hoursBetween } from "../data";

type Supa = SupabaseClient<Database>;

export type RepasseRow = {
  id: string;
  name: string;
  tier: string;
  sessionsCount: number;
  grossAmount: number;
  repasseAmount: number;
  statusLabel: "A pagar" | "Pago" | "Sem sessões";
  isLive: boolean;
};

/**
 * Linhas de repasse do mês corrente. `payouts`/`payout_items` (Fase 1,
 * PRD §8/§13 semana 11-12) ainda não têm fechamento automatizado rodando —
 * quando existe uma linha em `payouts` pra (terapeuta, competência) usamos
 * ela (fechada/aprovada/paga); quando não existe, calculamos ao vivo:
 * horas de sessão `realizada` no mês × `hourly_rate` do contrato vigente do
 * terapeuta. Isso é a mesma regra de "repasse por sessão" do PRD, só que
 * calculada sob demanda em vez de por um job de fechamento de competência.
 */
export async function getRepasseRows(
  supabase: Supa,
  clinicId: string,
): Promise<{ rows: RepasseRow[]; totalGross: number; totalOpenPayout: number }> {
  const { startISO, endISO, competenceMonth } = currentMonthRange();

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "terapeuta")
    .eq("active", true)
    .order("full_name");
  const list = therapists ?? [];
  if (list.length === 0) return { rows: [], totalGross: 0, totalOpenPayout: 0 };
  const ids = list.map((t) => t.id);

  const [{ data: contracts }, { data: sessions }, { data: existingPayouts }] = await Promise.all([
    supabase.from("therapist_contracts").select("profile_id, tier, hourly_rate, valid_from, valid_to").in("profile_id", ids),
    supabase
      .from("appointments")
      .select("id, therapist_id, starts_at, ends_at")
      .in("therapist_id", ids)
      .eq("status", "realizada")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO),
    supabase.from("payouts").select("therapist_id, gross_amount, adjustments, status, sessions_count").in("therapist_id", ids).eq("competence_month", competenceMonth),
  ]);

  const now = Date.now();
  const currentContract = new Map<string, { tier: string; hourlyRate: number }>();
  for (const c of contracts ?? []) {
    const from = new Date(c.valid_from).getTime();
    const to = c.valid_to ? new Date(c.valid_to).getTime() : null;
    if (from <= now && (to == null || to >= now)) currentContract.set(c.profile_id, { tier: c.tier, hourlyRate: Number(c.hourly_rate) });
  }

  const sessionsByTherapist = new Map<string, { id: string; starts_at: string; ends_at: string }[]>();
  for (const s of sessions ?? []) {
    const arr = sessionsByTherapist.get(s.therapist_id) ?? [];
    arr.push(s);
    sessionsByTherapist.set(s.therapist_id, arr);
  }

  const payoutByTherapist = new Map((existingPayouts ?? []).map((p) => [p.therapist_id, p]));

  let totalGross = 0;
  let totalOpenPayout = 0;
  const rows: RepasseRow[] = list.map((t) => {
    const contract = currentContract.get(t.id);
    const mySessions = sessionsByTherapist.get(t.id) ?? [];
    const existing = payoutByTherapist.get(t.id);

    let sessionsCount: number;
    let grossAmount: number;
    let repasseAmount: number;
    let statusLabel: RepasseRow["statusLabel"];
    let isLive: boolean;

    if (existing) {
      sessionsCount = existing.sessions_count;
      grossAmount = Number(existing.gross_amount);
      repasseAmount = grossAmount + Number(existing.adjustments ?? 0);
      statusLabel = sessionsCount === 0 ? "Sem sessões" : existing.status === "pago" ? "Pago" : "A pagar";
      isLive = false;
    } else {
      sessionsCount = mySessions.length;
      const hours = mySessions.reduce((sum, s) => sum + hoursBetween(s.starts_at, s.ends_at), 0);
      grossAmount = contract ? hours * contract.hourlyRate : 0;
      repasseAmount = grossAmount;
      statusLabel = sessionsCount === 0 ? "Sem sessões" : "A pagar";
      isLive = true;
    }

    totalGross += grossAmount;
    if (statusLabel === "A pagar") totalOpenPayout += repasseAmount;

    return {
      id: t.id,
      name: t.full_name,
      tier: contract?.tier ?? "—",
      sessionsCount,
      grossAmount,
      repasseAmount,
      statusLabel,
      isLive,
    };
  });

  return { rows, totalGross, totalOpenPayout };
}

export type GlosaRow = {
  id: string;
  insurerName: string;
  guideNumber: string;
  procedureCode: string;
  reason: string;
  amount: number;
  statusLabel: string;
  tagClass: string;
};

const BILLING_STATUS_LABEL: Record<string, { label: string; tagClass: string }> = {
  glosado: { label: "Glosada", tagClass: "st-falta" },
  recursado: { label: "Em recurso", tagClass: "st-em-atendimento" },
  recuperado: { label: "Recuperada", tagClass: "st-confirmada" },
};

export async function getGlosaRows(supabase: Supa, clinicId: string): Promise<GlosaRow[]> {
  const { data: insurers } = await supabase.from("insurers").select("id, name").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  if (insurerIds.length === 0) return [];
  const insurerNameById = new Map((insurers ?? []).map((i) => [i.id, i.name]));

  const { data: periods } = await supabase.from("billing_periods").select("id, insurer_id").in("insurer_id", insurerIds);
  const periodIds = (periods ?? []).map((p) => p.id);
  const insurerByPeriod = new Map((periods ?? []).map((p) => [p.id, p.insurer_id]));
  if (periodIds.length === 0) return [];

  const { data: items } = await supabase
    .from("billing_items")
    .select("id, billing_period_id, procedure_code, status, appointment_id")
    .in("billing_period_id", periodIds)
    .in("status", ["glosado", "recursado", "recuperado"]);
  const itemList = items ?? [];
  if (itemList.length === 0) return [];
  const itemById = new Map(itemList.map((i) => [i.id, i]));

  const appointmentIds = [...new Set(itemList.map((i) => i.appointment_id))];
  const { data: appointments } = await supabase.from("appointments").select("id, authorization_id").in("id", appointmentIds);
  const authByAppointment = new Map((appointments ?? []).map((a) => [a.id, a.authorization_id]));
  const authIds = [...new Set((appointments ?? []).map((a) => a.authorization_id).filter((id): id is string => id != null))];
  const { data: authorizations } = authIds.length
    ? await supabase.from("authorizations").select("id, guide_number").in("id", authIds)
    : { data: [] as { id: string; guide_number: string | null }[] };
  const guideByAuth = new Map((authorizations ?? []).map((a) => [a.id, a.guide_number]));

  const { data: glosas } = await supabase
    .from("glosas")
    .select("id, billing_item_id, reason_code, reason_text, amount")
    .in(
      "billing_item_id",
      itemList.map((i) => i.id),
    );

  return (glosas ?? []).map((g) => {
    const item = itemById.get(g.billing_item_id);
    const insurerId = item ? insurerByPeriod.get(item.billing_period_id) : undefined;
    const authId = item ? authByAppointment.get(item.appointment_id) : undefined;
    const style = BILLING_STATUS_LABEL[item?.status ?? "glosado"] ?? BILLING_STATUS_LABEL.glosado!;
    return {
      id: g.id,
      insurerName: insurerId ? (insurerNameById.get(insurerId) ?? "—") : "—",
      guideNumber: (authId && guideByAuth.get(authId)) || "sem nº de guia",
      procedureCode: item?.procedure_code ?? "—",
      reason: g.reason_text ?? g.reason_code,
      amount: Number(g.amount),
      statusLabel: style.label,
      tagClass: style.tagClass,
    };
  });
}

export type FinanceiroKpis = {
  receitaBruta: number;
  repassesAPagar: number;
  glosasEmAberto: number;
  dsoMedioDias: number | null;
};

export async function getFinanceiroKpis(
  supabase: Supa,
  clinicId: string,
  repassesAPagar: number,
  glosaRows: GlosaRow[],
): Promise<FinanceiroKpis> {
  const { startISO, endISO } = currentMonthRange();
  const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);

  let receitaBruta = 0;
  let dsoMedioDias: number | null = null;
  if (insurerIds.length > 0) {
    const { data: periods } = await supabase.from("billing_periods").select("id, exported_at").in("insurer_id", insurerIds);
    const periodIds = (periods ?? []).map((p) => p.id);
    const exportedAtByPeriod = new Map((periods ?? []).map((p) => [p.id, p.exported_at]));
    if (periodIds.length > 0) {
      const { data: monthItems } = await supabase
        .from("appointments")
        .select("id, starts_at, patients!inner(clinic_id)")
        .eq("patients.clinic_id", clinicId)
        .gte("starts_at", startISO)
        .lt("starts_at", endISO);
      const monthApptIds = new Set((monthItems ?? []).map((a) => a.id));
      const { data: items } = await supabase.from("billing_items").select("amount, appointment_id, paid_at, billing_period_id").in("billing_period_id", periodIds);
      for (const item of items ?? []) {
        if (monthApptIds.has(item.appointment_id)) receitaBruta += Number(item.amount);
      }
      const dsoSamples: number[] = [];
      for (const item of items ?? []) {
        const exportedAt = exportedAtByPeriod.get(item.billing_period_id);
        if (item.paid_at && exportedAt) {
          const days = (new Date(item.paid_at).getTime() - new Date(exportedAt).getTime()) / (24 * 60 * 60 * 1000);
          if (days >= 0) dsoSamples.push(days);
        }
      }
      if (dsoSamples.length > 0) dsoMedioDias = Math.round(dsoSamples.reduce((s, d) => s + d, 0) / dsoSamples.length);
    }
  }

  const glosasEmAberto = glosaRows.filter((g) => g.statusLabel !== "Recuperada").reduce((sum, g) => sum + g.amount, 0);

  return { receitaBruta, repassesAPagar, glosasEmAberto, dsoMedioDias };
}

export type MonthRevenueBar = { label: string; ok: number; glosa: number };

export async function getRevenueByMonth(supabase: Supa, clinicId: string): Promise<MonthRevenueBar[]> {
  const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  if (insurerIds.length === 0) return [];

  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString().slice(0, 10);

  const { data: periods } = await supabase
    .from("billing_periods")
    .select("id, competence_month")
    .in("insurer_id", insurerIds)
    .gte("competence_month", sixMonthsAgo);
  const periodList = periods ?? [];
  if (periodList.length === 0) return [];
  const monthByPeriod = new Map(periodList.map((p) => [p.id, p.competence_month.slice(0, 7)]));

  const { data: items } = await supabase.from("billing_items").select("amount, status, billing_period_id").in(
    "billing_period_id",
    periodList.map((p) => p.id),
  );

  const buckets = new Map<string, { ok: number; glosa: number }>();
  for (let i = 5; i >= 0; i--) {
    const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    buckets.set(key, { ok: 0, glosa: 0 });
  }
  for (const item of items ?? []) {
    const month = monthByPeriod.get(item.billing_period_id);
    const bucket = month ? buckets.get(month) : undefined;
    if (!bucket) continue;
    if (item.status === "glosado") bucket.glosa += Number(item.amount);
    else bucket.ok += Number(item.amount);
  }

  return [...buckets.entries()].map(([key, v]) => {
    const [year, month] = key.split("-");
    const label = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("pt-BR", { month: "short" });
    return { label, ok: v.ok, glosa: v.glosa };
  });
}

export type TierRepasseBar = { tier: string; amount: number };

export function getRepasseByTier(rows: RepasseRow[]): TierRepasseBar[] {
  const byTier = new Map<string, number>();
  for (const r of rows) {
    byTier.set(r.tier, (byTier.get(r.tier) ?? 0) + r.repasseAmount);
  }
  return [...byTier.entries()]
    .map(([tier, amount]) => ({ tier, amount }))
    .sort((a, b) => b.amount - a.amount);
}
