import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

/**
 * Números ao vivo da Clínica pro módulo financeiro HUB, em regime de caixa
 * (usa `paid_at`, não a data do serviço) pra bater com o Fluxo de Caixa —
 * o DRE por competência já existe em app/gestor/financeiro/dre/data.ts
 * (getDreByMonth) e não é duplicado aqui.
 *
 * Fontes cobertas: billing_items (convênio), patient_charges (cobrança
 * avulsa particular), accounts_payable (despesa operacional), payouts
 * (repasse a terapeuta). `patient_contracts`/mensalidade recorrente NÃO
 * existe nas migrations deste repo hoje — se for criada depois, some aqui.
 */
export type ClinicaMonthlyFigures = {
  receitaConvenio: number;
  receitaParticular: number;
  despesasOperacionais: number;
  repasseTerapeutas: number;
};

function monthRange(competenceMonth: string) {
  const [y, m] = competenceMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start, end };
}

export async function getClinicaMonthlyFigures(
  supabase: Supa,
  clinicId: string,
  competenceMonth: string
): Promise<ClinicaMonthlyFigures> {
  const { start, end } = monthRange(competenceMonth);

  const [billingRes, chargesRes, payableRes, payoutsRes] = await Promise.all([
    supabase
      .from("billing_items")
      .select("amount, paid_at, billing_period_id")
      .eq("status", "pago")
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("patient_charges")
      .select("amount, paid_at, patient_id, patients!inner(clinic_id)")
      .eq("status", "pago")
      .eq("patients.clinic_id", clinicId)
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("accounts_payable")
      .select("amount")
      .eq("clinic_id", clinicId)
      .eq("status", "pago")
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("payouts")
      .select("gross_amount, adjustments, therapist_id, profiles!inner(clinic_id)")
      .eq("competence_month", start)
      .eq("status", "pago")
      .eq("profiles.clinic_id", clinicId),
  ]);

  const receitaConvenio = (billingRes.data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const receitaParticular = (chargesRes.data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const despesasOperacionais = (payableRes.data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const repasseTerapeutas = (payoutsRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.gross_amount ?? 0) + Number(r.adjustments ?? 0),
    0
  );

  return { receitaConvenio, receitaParticular, despesasOperacionais, repasseTerapeutas };
}
