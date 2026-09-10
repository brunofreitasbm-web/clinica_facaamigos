import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { currentMonthRange } from "@/app/gestor/data";
import type { PayoutStatementData, PayoutItemRow } from "@/components/payout-statement";

type Supa = SupabaseClient<Database>;

function monthLabel(competenceMonth: string): string {
  const [year, month] = competenceMonth.split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const PERIOD_LABEL: Record<string, string> = { matutino: "Matutino", vespertino: "Vespertino" };

export type MyContract = {
  tier: string;
  modulePrice: number;
  attendancesPerModule: number;
  docDeadlineDays: number;
  noshowCompensationPct: number;
} | null;

/** Faixa/honorário por Módulo Assistencial vigente hoje do terapeuta logado — mesma janela de vigência usada no fechamento de competência (§8, cláusula 6ª do contrato-quadro PJ–PJ). */
export async function getMyContract(supabase: Supa, therapistId: string): Promise<MyContract> {
  const { data } = await supabase
    .from("therapist_contracts")
    .select("tier, module_price, attendances_per_module, doc_deadline_days, noshow_compensation_pct, valid_from, valid_to")
    .eq("profile_id", therapistId)
    .not("module_price", "is", null);
  const now = Date.now();
  const current = (data ?? []).find((c) => {
    const from = new Date(c.valid_from).getTime();
    const to = c.valid_to ? new Date(c.valid_to).getTime() : null;
    return from <= now && (to == null || to >= now);
  });
  return current
    ? {
        tier: current.tier,
        modulePrice: Number(current.module_price),
        attendancesPerModule: current.attendances_per_module,
        docDeadlineDays: current.doc_deadline_days,
        noshowCompensationPct: Number(current.noshow_compensation_pct),
      }
    : null;
}

export type PayoutHistoryRow = {
  payoutId: string | null;
  competenceMonth: string;
  competenceLabel: string;
  modulesDeliveredCount: number;
  grossAmount: number;
  indemnityAmount: number;
  netAmount: number;
  statusLabel: "Sem módulos" | "A pagar" | "Pago";
  isLive: boolean;
};

/**
 * Histórico de repasses do terapeuta logado, por Módulo Assistencial
 * entregue (cláusula 6ª): linhas já fechadas em `payouts` (RLS já restringe
 * a `therapist_id = auth.uid()`, ver migration 20260904000010) mais o mês
 * corrente calculado ao vivo via `compute_assistance_modules` quando ainda
 * não foi fechado — mesma regra usada em `app/gestor/financeiro/data.ts`,
 * só que do ponto de vista do próprio PJ.
 */
export async function getMyPayoutHistory(
  supabase: Supa,
  therapistId: string,
  contract: MyContract,
): Promise<PayoutHistoryRow[]> {
  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, competence_month, modules_delivered_count, gross_amount, indemnity_amount, adjustments, status")
    .eq("therapist_id", therapistId)
    .order("competence_month", { ascending: false });

  const closedRows: PayoutHistoryRow[] = (payouts ?? []).map((p) => {
    const competenceMonth = p.competence_month.slice(0, 7);
    const gross = Number(p.gross_amount);
    const indemnity = Number(p.indemnity_amount ?? 0);
    return {
      payoutId: p.id,
      competenceMonth,
      competenceLabel: monthLabel(competenceMonth),
      modulesDeliveredCount: p.modules_delivered_count,
      grossAmount: gross,
      indemnityAmount: indemnity,
      netAmount: gross + indemnity + Number(p.adjustments ?? 0),
      statusLabel: p.modules_delivered_count === 0 && indemnity === 0 ? "Sem módulos" : p.status === "pago" ? "Pago" : "A pagar",
      isLive: false,
    };
  });

  const { competenceMonth: currentCompetence, startISO, endISO } = currentMonthRange();
  const hasCurrentClosed = closedRows.some((r) => r.competenceMonth === currentCompetence.slice(0, 7));

  if (!hasCurrentClosed) {
    const { data: modules } = await supabase.rpc("compute_assistance_modules", {
      p_therapist_ids: [therapistId],
      p_period_start: startISO,
      p_period_end: endISO,
    });
    const moduleList = modules ?? [];
    const deliveredCount = moduleList.filter((m) => m.delivered).length;
    const emptiedCount = moduleList.filter((m) => m.emptied_by_noshow).length;
    const grossAmount = contract ? deliveredCount * contract.modulePrice : 0;
    const indemnityAmount = contract ? emptiedCount * contract.modulePrice * (contract.noshowCompensationPct / 100) : 0;
    closedRows.unshift({
      payoutId: null,
      competenceMonth: currentCompetence.slice(0, 7),
      competenceLabel: monthLabel(currentCompetence.slice(0, 7)),
      modulesDeliveredCount: deliveredCount,
      grossAmount,
      indemnityAmount,
      netAmount: grossAmount + indemnityAmount,
      statusLabel: deliveredCount === 0 && indemnityAmount === 0 ? "Sem módulos" : "A pagar",
      isLive: true,
    });
  }

  return closedRows;
}

/**
 * Monta os dados de impressão (`PayoutStatementModal`) para uma competência
 * específica do terapeuta logado: se `payoutId` existir, usa os
 * `payout_items` fechados (preço aplicado na competência); senão, monta a
 * partir de `compute_assistance_modules` ao vivo pro mês corrente.
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
  const modulePrice = row.modulesDeliveredCount > 0 ? row.grossAmount / row.modulesDeliveredCount : (contract?.modulePrice ?? 0);

  if (row.payoutId) {
    const { data: payoutItems } = await supabase
      .from("payout_items")
      .select("id, item_type, service_date, period, module_price_applied, rate_applied, appointment_ids, appointments(id, starts_at, discipline, patients(full_name))")
      .eq("payout_id", row.payoutId);
    items = (payoutItems ?? []).map((it) => {
      if (it.item_type === "sessao") {
        const appt = it.appointments as { starts_at: string; discipline: string; patients: { full_name: string } | null } | null;
        return {
          id: it.id,
          label: appt
            ? `${new Date(appt.starts_at).toLocaleDateString("pt-BR")} · ${appt.patients?.full_name ?? "—"} · ${appt.discipline}`
            : "—",
          kind: "sessao" as const,
          amount: Number(it.rate_applied ?? 0),
        };
      }
      const attendanceCount = (it.appointment_ids ?? []).length;
      const dateLabel = it.service_date ? new Date(`${it.service_date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
      const periodLabel = it.period ? (PERIOD_LABEL[it.period] ?? it.period) : "—";
      return {
        id: it.id,
        label:
          it.item_type === "indenizacao_noshow"
            ? `${dateLabel} · ${periodLabel} · esvaziado por falta (aviso <24h)`
            : `${dateLabel} · ${periodLabel} · ${attendanceCount} atendimento(s)`,
        kind: it.item_type as "modulo" | "indenizacao_noshow",
        amount: Number(it.module_price_applied ?? 0),
      };
    });
  } else {
    const { startISO, endISO } = currentMonthRange();
    const { data: modules } = await supabase.rpc("compute_assistance_modules", {
      p_therapist_ids: [therapistId],
      p_period_start: startISO,
      p_period_end: endISO,
    });
    const moduleList = modules ?? [];
    const emptiedCount = moduleList.filter((m) => m.emptied_by_noshow).length;
    const indemnityPerModule = emptiedCount > 0 ? row.indemnityAmount / emptiedCount : 0;
    items = moduleList
      .filter((m) => m.delivered || m.emptied_by_noshow)
      .map((m, i) => {
        const dateLabel = new Date(`${m.service_date}T12:00:00`).toLocaleDateString("pt-BR");
        const periodLabel = PERIOD_LABEL[m.period ?? ""] ?? m.period ?? "—";
        return {
          id: `${therapistId}-${i}`,
          label: m.delivered
            ? `${dateLabel} · ${periodLabel} · ${(m.appointment_ids ?? []).length} atendimento(s)`
            : `${dateLabel} · ${periodLabel} · esvaziado por falta (aviso <24h)`,
          kind: m.delivered ? ("modulo" as const) : ("indenizacao_noshow" as const),
          amount: m.delivered ? modulePrice : indemnityPerModule,
        };
      });
  }

  return {
    therapistName,
    councilNumber: councilNumber ?? "—",
    competenceMonth: row.competenceLabel,
    tierName: contract?.tier ?? "—",
    modulePrice,
    totalModulesDelivered: row.modulesDeliveredCount,
    grossAmount: row.grossAmount,
    indemnityAmount: row.indemnityAmount,
    adjustments: row.netAmount - row.grossAmount - row.indemnityAmount,
    netAmount: row.netAmount,
    status: row.isLive ? "pendente" : row.statusLabel === "Pago" ? "pago" : "aprovado",
    items,
  };
}
