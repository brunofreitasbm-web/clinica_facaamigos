import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

export type RemittanceLineRow = {
  id: string;
  guideNumber: string | null;
  patientName: string | null;
  procedureCode: string | null;
  sessions: number | null;
  grossAmount: number | null;
  glosaAmount: number | null;
  netAmount: number;
  serviceDate: string | null;
  lowConfidence: boolean;
  consolidated: boolean;
};

export type RemittanceBatchRow = {
  id: string;
  insurerName: string | null;
  fileName: string;
  competenceMonth: string;
  createdAt: string;
  warnings: string[];
  totalGross: number;
  totalGlosa: number;
  totalNet: number;
  consolidatedNet: number;
  consolidatedCount: number;
  lines: RemittanceLineRow[];
};

/** Notas dos planos já lidas, mais recentes primeiro, com as linhas de cada uma. */
export async function getRemittanceBatches(supabase: Supa, clinicId: string, limit = 12): Promise<RemittanceBatchRow[]> {
  const { data: batches } = await supabase
    .from("insurance_remittance_batches")
    .select("id, insurer_name, file_name, competence_month, created_at, warnings, total_gross, total_glosa, total_net")
    .eq("clinic_id", clinicId)
    .order("competence_month", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!batches || batches.length === 0) return [];

  const { data: lines } = await supabase
    .from("insurance_remittance_lines")
    .select(
      "id, batch_id, guide_number, patient_name, procedure_code, sessions, gross_amount, glosa_amount, net_amount, service_date, low_confidence, consolidated",
    )
    .in(
      "batch_id",
      batches.map((b) => b.id),
    )
    .order("created_at", { ascending: true });

  const linesByBatch = new Map<string, RemittanceLineRow[]>();
  for (const line of lines ?? []) {
    const list = linesByBatch.get(line.batch_id) ?? [];
    list.push({
      id: line.id,
      guideNumber: line.guide_number,
      patientName: line.patient_name,
      procedureCode: line.procedure_code,
      sessions: line.sessions,
      grossAmount: line.gross_amount === null ? null : Number(line.gross_amount),
      glosaAmount: line.glosa_amount === null ? null : Number(line.glosa_amount),
      netAmount: Number(line.net_amount),
      serviceDate: line.service_date,
      lowConfidence: line.low_confidence,
      consolidated: line.consolidated,
    });
    linesByBatch.set(line.batch_id, list);
  }

  return batches.map((batch) => {
    const batchLines = linesByBatch.get(batch.id) ?? [];
    const consolidated = batchLines.filter((l) => l.consolidated);
    return {
      id: batch.id,
      insurerName: batch.insurer_name,
      fileName: batch.file_name,
      competenceMonth: batch.competence_month.slice(0, 7),
      createdAt: batch.created_at,
      warnings: Array.isArray(batch.warnings) ? (batch.warnings as unknown[]).filter((w): w is string => typeof w === "string") : [],
      totalGross: Number(batch.total_gross),
      totalGlosa: Number(batch.total_glosa),
      totalNet: Number(batch.total_net),
      consolidatedNet: consolidated.reduce((sum, l) => sum + l.netAmount, 0),
      consolidatedCount: consolidated.length,
      lines: batchLines,
    };
  });
}

/**
 * Recebível consolidado por competência (YYYY-MM) — só as linhas marcadas no
 * checkbox. É o que a DRE usa para trocar o convênio faturado pelo que o plano
 * de fato vai pagar.
 */
export async function getConsolidatedReceivablesByMonth(
  supabase: Supa,
  clinicId: string,
  fromMonth: string,
): Promise<Map<string, { amount: number; lineCount: number }>> {
  const { data } = await supabase
    .from("insurance_remittance_lines")
    .select("competence_month, net_amount")
    .eq("clinic_id", clinicId)
    .eq("consolidated", true)
    .gte("competence_month", `${fromMonth}-01`);

  const byMonth = new Map<string, { amount: number; lineCount: number }>();
  for (const row of data ?? []) {
    const key = row.competence_month.slice(0, 7);
    const current = byMonth.get(key) ?? { amount: 0, lineCount: 0 };
    byMonth.set(key, { amount: current.amount + Number(row.net_amount), lineCount: current.lineCount + 1 });
  }
  return byMonth;
}

/**
 * Receita de convênio já faturada por competência — billing_items de períodos
 * de faturamento com convênio. É o número que o recebível conciliado substitui
 * na DRE; sem ele a nota entraria somada à mesma receita, contando duas vezes.
 */
export async function getInsurerBilledByMonth(supabase: Supa, clinicId: string, fromMonth: string): Promise<Map<string, number>> {
  const { data: periods } = await supabase
    .from("billing_periods")
    .select("id, competence_month, insurer_id")
    .not("insurer_id", "is", null)
    .gte("competence_month", `${fromMonth}-01`);

  if (!periods || periods.length === 0) return new Map();

  const monthByPeriod = new Map(periods.map((p) => [p.id, p.competence_month.slice(0, 7)]));

  const { data: items } = await supabase
    .from("billing_items")
    .select("amount, status, billing_period_id")
    .in("billing_period_id", Array.from(monthByPeriod.keys()))
    .neq("status", "cancelado");

  const byMonth = new Map<string, number>();
  for (const item of items ?? []) {
    if (!item.billing_period_id) continue;
    const key = monthByPeriod.get(item.billing_period_id);
    if (!key) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(item.amount));
  }

  // clinic_id não existe em billing_items/billing_periods: o recorte por clínica
  // é o da RLS, que já limita as duas tabelas à clínica do usuário.
  void clinicId;
  return byMonth;
}
