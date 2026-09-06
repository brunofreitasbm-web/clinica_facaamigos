import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { currentMonthRange, hoursBetween } from "@/app/gestor/data";
import type { PayoutStatementData, PayoutItemRow } from "@/components/payout-statement";

type Supa = SupabaseClient<Database>;

function monthLabel(competenceMonth: string): string {
  const [year, month] = competenceMonth.split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type MyContract = { tier: string; hourlyRate: number } | null;

/** Faixa/valor-hora vigente hoje do terapeuta logado — mesma janela de vigência usada no fechamento de competência (§8). */
export async function getMyContract(supabase: Supa, therapistId: string): Promise<MyContract> {
  const { data } = await supabase
    .from("therapist_contracts")
    .select("tier, hourly_rate, valid_from, valid_to")
    .eq("profile_id", therapistId);
  const now = Date.now();
  const current = (data ?? []).find((c) => {
    const from = new Date(c.valid_from).getTime();
    const to = c.valid_to ? new Date(c.valid_to).getTime() : null;
    return from <= now && (to == null || to >= now);
  });
  return current ? { tier: current.tier, hourlyRate: Number(current.hourly_rate) } : null;
}

export type PayoutHistoryRow = {
  payoutId: string | null;
  competenceMonth: string;
  competenceLabel: string;
  sessionsCount: number;
  grossAmount: number;
  netAmount: number;
  statusLabel: "Sem sessões" | "A pagar" | "Pago";
  isLive: boolean;
};

/**
 * Histórico de repasses do terapeuta logado: linhas já fechadas em `payouts`
 * (RLS já restringe a `therapist_id = auth.uid()`, ver migration
 * 20260904000010) mais o mês corrente calculado ao vivo quando ainda não foi
 * fechado — mesma regra de "repasse por sessão" usada em
 * `app/gestor/financeiro/data.ts`, só que do ponto de vista do próprio PJ.
 */
export async function getMyPayoutHistory(
  supabase: Supa,
  therapistId: string,
  contract: MyContract,
): Promise<PayoutHistoryRow[]> {
  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, competence_month, sessions_count, gross_amount, adjustments, status")
    .eq("therapist_id", therapistId)
    .order("competence_month", { ascending: false });

  const closedRows: PayoutHistoryRow[] = (payouts ?? []).map((p) => {
    const competenceMonth = p.competence_month.slice(0, 7);
    const gross = Number(p.gross_amount);
    return {
      payoutId: p.id,
      competenceMonth,
      competenceLabel: monthLabel(competenceMonth),
      sessionsCount: p.sessions_count,
      grossAmount: gross,
      netAmount: gross + Number(p.adjustments ?? 0),
      statusLabel: p.sessions_count === 0 ? "Sem sessões" : p.status === "pago" ? "Pago" : "A pagar",
      isLive: false,
    };
  });

  const { competenceMonth: currentCompetence, startISO, endISO } = currentMonthRange();
  const hasCurrentClosed = closedRows.some((r) => r.competenceMonth === currentCompetence.slice(0, 7));

  if (!hasCurrentClosed) {
    const { data: sessions } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at")
      .eq("therapist_id", therapistId)
      .eq("status", "realizada")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO);
    const mySessions = sessions ?? [];
    const hours = mySessions.reduce((sum, s) => sum + hoursBetween(s.starts_at, s.ends_at), 0);
    const grossAmount = contract ? hours * contract.hourlyRate : 0;
    closedRows.unshift({
      payoutId: null,
      competenceMonth: currentCompetence.slice(0, 7),
      competenceLabel: monthLabel(currentCompetence.slice(0, 7)),
      sessionsCount: mySessions.length,
      grossAmount,
      netAmount: grossAmount,
      statusLabel: mySessions.length === 0 ? "Sem sessões" : "A pagar",
      isLive: true,
    });
  }

  return closedRows;
}

/**
 * Monta os dados de impressão (`PayoutStatementModal`) para uma competência
 * específica do terapeuta logado: se `payoutId` existir, usa os
 * `payout_items` fechados (taxa aplicada na data da sessão); senão, monta a
 * partir das sessões `realizada` do mês ao vivo.
 */
export async function getMyPayoutStatement(
  supabase: Supa,
  therapistId: string,
  therapistName: string,
  councilNumber: string | null,
  contract: MyContract,
  row: PayoutHistoryRow,
): Promise<PayoutStatementData> {
  let items: PayoutItemRow[] = [];

  if (row.payoutId) {
    const { data: payoutItems } = await supabase
      .from("payout_items")
      .select("id, rate_applied, appointments(id, starts_at, ends_at, discipline, patients(full_name))")
      .eq("payout_id", row.payoutId);
    items = (payoutItems ?? []).map((it) => {
      const appt = it.appointments as {
        starts_at: string;
        ends_at: string;
        discipline: string;
        patients: { full_name: string } | null;
      } | null;
      const rate = Number(it.rate_applied);
      const hours = appt ? hoursBetween(appt.starts_at, appt.ends_at) : 0;
      return {
        id: it.id,
        date: appt ? new Date(appt.starts_at).toLocaleDateString("pt-BR") : "—",
        patientName: appt?.patients?.full_name ?? "—",
        discipline: appt?.discipline ?? "—",
        hourlyRate: rate,
        amount: hours * rate,
      };
    });
  } else {
    const { startISO, endISO } = currentMonthRange();
    const { data: sessions } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, discipline, patients(full_name)")
      .eq("therapist_id", therapistId)
      .eq("status", "realizada")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO)
      .order("starts_at");
    const rate = contract?.hourlyRate ?? 0;
    items = (sessions ?? []).map((s) => {
      const hours = hoursBetween(s.starts_at, s.ends_at);
      return {
        id: s.id,
        date: new Date(s.starts_at).toLocaleDateString("pt-BR"),
        patientName: (s.patients as { full_name: string } | null)?.full_name ?? "—",
        discipline: s.discipline,
        hourlyRate: rate,
        amount: hours * rate,
      };
    });
  }

  return {
    therapistName,
    councilNumber: councilNumber ?? "—",
    competenceMonth: row.competenceLabel,
    tierName: contract?.tier ?? "—",
    hourlyRate: contract?.hourlyRate ?? 0,
    totalSessions: row.sessionsCount,
    grossAmount: row.grossAmount,
    adjustments: row.netAmount - row.grossAmount,
    netAmount: row.netAmount,
    status: row.isLive ? "pendente" : row.statusLabel === "Pago" ? "pago" : "aprovado",
    items,
  };
}
