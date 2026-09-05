import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

export type GlosaBreakdownRow = {
  label: string;
  count: number;
  amount: number;
  recoveredAmount: number;
  recoveryRatePct: number | null;
};

export type GlosaBreakdown = {
  byReason: GlosaBreakdownRow[];
  byInsurer: GlosaBreakdownRow[];
  byPerson: GlosaBreakdownRow[];
  totalAmount: number;
  totalRecovered: number;
  totalCount: number;
};

const ATTRIBUTABLE_LABEL: Record<string, string> = {
  terapeuta: "Terapeuta",
  recepcao: "Recepção",
  faturamento: "Faturamento",
  operadora: "Operadora",
};

function aggregate(
  rows: { key: string; amount: number; recovered: number }[],
): GlosaBreakdownRow[] {
  const byKey = new Map<string, { count: number; amount: number; recoveredAmount: number }>();
  for (const r of rows) {
    const bucket = byKey.get(r.key) ?? { count: 0, amount: 0, recoveredAmount: 0 };
    bucket.count += 1;
    bucket.amount += r.amount;
    bucket.recoveredAmount += r.recovered;
    byKey.set(r.key, bucket);
  }
  return [...byKey.entries()]
    .map(([label, b]) => ({
      label,
      count: b.count,
      amount: b.amount,
      recoveredAmount: b.recoveredAmount,
      recoveryRatePct: b.amount > 0 ? Math.round((b.recoveredAmount / b.amount) * 100) : null,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Painel de glosa por motivo/convênio/pessoa (§9.8/§10.4). Evita `.eq()` em
 * caminho de embed com mais de 1 nível (glosas → billing_items →
 * billing_periods → insurers) — o mesmo cuidado documentado em
 * app/recepcao/page.tsx: PostgREST não garante filtro em embed
 * profundamente aninhado, então filtramos clinic_id na tabela-base
 * (insurers) e vamos descendo os ids, juntando tudo em JS.
 */
export async function getGlosaBreakdown(supabase: Supa, clinicId: string): Promise<GlosaBreakdown> {
  const empty: GlosaBreakdown = { byReason: [], byInsurer: [], byPerson: [], totalAmount: 0, totalRecovered: 0, totalCount: 0 };

  const { data: insurers } = await supabase.from("insurers").select("id, name").eq("clinic_id", clinicId);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  const insurerNameById = new Map((insurers ?? []).map((i) => [i.id, i.name]));
  if (insurerIds.length === 0) return empty;

  const { data: periods } = await supabase.from("billing_periods").select("id, insurer_id").in("insurer_id", insurerIds);
  const periodIds = (periods ?? []).map((p) => p.id);
  const insurerNameByPeriod = new Map((periods ?? []).map((p) => [p.id, insurerNameById.get(p.insurer_id) ?? "Convênio"]));
  if (periodIds.length === 0) return empty;

  const { data: billingItems } = await supabase
    .from("billing_items")
    .select("id, billing_period_id")
    .in("billing_period_id", periodIds);
  const billingItemIds = (billingItems ?? []).map((b) => b.id);
  const insurerNameByItem = new Map(
    (billingItems ?? []).map((b) => [b.id, insurerNameByPeriod.get(b.billing_period_id) ?? "Convênio"]),
  );
  if (billingItemIds.length === 0) return empty;

  const { data: glosas } = await supabase
    .from("glosas")
    .select("billing_item_id, reason_code, attributable_to, amount, recovered_amount, attributable_profile:profiles!attributable_profile_id(full_name)")
    .in("billing_item_id", billingItemIds);
  const list = glosas ?? [];
  if (list.length === 0) return empty;

  const byReasonInput = list.map((g) => ({
    key: g.reason_code,
    amount: Number(g.amount),
    recovered: Number(g.recovered_amount ?? 0),
  }));

  const byInsurerInput = list.map((g) => ({
    key: insurerNameByItem.get(g.billing_item_id) ?? "Convênio",
    amount: Number(g.amount),
    recovered: Number(g.recovered_amount ?? 0),
  }));

  const byPersonInput = list.map((g) => {
    const profile = Array.isArray(g.attributable_profile) ? g.attributable_profile[0] : g.attributable_profile;
    const label = profile?.full_name
      ? `${profile.full_name} (${ATTRIBUTABLE_LABEL[g.attributable_to] ?? g.attributable_to})`
      : ATTRIBUTABLE_LABEL[g.attributable_to] ?? g.attributable_to;
    return { key: label, amount: Number(g.amount), recovered: Number(g.recovered_amount ?? 0) };
  });

  const totalAmount = list.reduce((sum, g) => sum + Number(g.amount), 0);
  const totalRecovered = list.reduce((sum, g) => sum + Number(g.recovered_amount ?? 0), 0);

  return {
    byReason: aggregate(byReasonInput),
    byInsurer: aggregate(byInsurerInput),
    byPerson: aggregate(byPersonInput),
    totalAmount,
    totalRecovered,
    totalCount: list.length,
  };
}
