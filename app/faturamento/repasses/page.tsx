import { FaturamentoHeader } from "../faturamento-header";
import { PayoutStatementModal } from "@/components/payout-statement";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { currentMonthRange, hoursBetween } from "../../gestor/data";
import { getRepasseRows, type RepasseRow } from "../../gestor/financeiro/data";
import { CloseCompetenceButton, MarkPaidButton } from "./repasses-actions";
import type { PayoutStatementData, PayoutItemRow } from "@/components/payout-statement";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const STATUS_BADGE: Record<RepasseRow["statusLabel"], string> = {
  Pago: "bg-status-positive-soft text-status-positive-text",
  "A pagar": "bg-status-pending-soft text-status-pending-text",
  "Sem sessões": "bg-paper-subtle text-ink-faint",
};

/** Monta os itens do extrato imprimível de uma linha de repasse — a partir de `payout_items` fechados, ou ao vivo pelas sessões `realizada` do mês quando a competência ainda não foi fechada. */
async function buildStatement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: RepasseRow,
  competenceLabel: string,
): Promise<PayoutStatementData> {
  let items: PayoutItemRow[] = [];

  if (!row.isLive && row.payoutId) {
    const { data: payoutItems } = await supabase
      .from("payout_items")
      .select("id, rate_applied, appointments(starts_at, ends_at, discipline, patients(full_name))")
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
      .eq("therapist_id", row.id)
      .eq("status", "realizada")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO)
      .order("starts_at");
    const rate = row.sessionsCount > 0 ? row.grossAmount / row.sessionsCount : 0;
    items = (sessions ?? []).map((s) => ({
      id: s.id,
      date: new Date(s.starts_at).toLocaleDateString("pt-BR"),
      patientName: (s.patients as { full_name: string } | null)?.full_name ?? "—",
      discipline: s.discipline,
      hourlyRate: rate,
      amount: rate * hoursBetween(s.starts_at, s.ends_at),
    }));
  }

  return {
    therapistName: row.name,
    councilNumber: "—",
    competenceMonth: competenceLabel,
    tierName: row.tier,
    hourlyRate: row.sessionsCount > 0 ? row.grossAmount / row.sessionsCount : 0,
    totalSessions: row.sessionsCount,
    grossAmount: row.grossAmount,
    adjustments: row.repasseAmount - row.grossAmount,
    netAmount: row.repasseAmount,
    status: row.isLive ? "pendente" : row.statusLabel === "Pago" ? "pago" : "aprovado",
    items,
  };
}

export default async function RepassesPage() {
  const supabase = await createClient();
  const { competenceMonth } = currentMonthRange();
  const competenceLabel = new Date(`${competenceMonth}T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const { rows } = await getRepasseRows(supabase, DEV_CLINIC_ID);
  const statements = await Promise.all(rows.map((r) => buildStatement(supabase, r, competenceLabel)));

  const totals = rows.reduce(
    (acc, r) => ({
      totalGross: acc.totalGross + r.grossAmount,
      totalNetPayout: acc.totalNetPayout + r.repasseAmount,
      totalSessions: acc.totalSessions + r.sessionsCount,
    }),
    { totalGross: 0, totalNetPayout: 0, totalSessions: 0 },
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <FaturamentoHeader active="repasses" />

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-paper-line pb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
              Repasse Financeiro PJ (Split Terapeutas)
            </h1>
            <p className="text-sm text-ink-soft">
              Cálculo do repasse por sessão realizada, competência {competenceLabel}.
            </p>
          </div>

          <CloseCompetenceButton competenceMonth={competenceMonth} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Total Bruto no Período</span>
            <div className="text-2xl font-semibold text-ink tabular-nums mt-1 font-mono">{currency.format(totals.totalGross)}</div>
            <div className="text-[11px] text-ink-soft mt-1">{totals.totalSessions} sessões realizadas</div>
          </div>

          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Total Repasse (A Pagar/Pago)</span>
            <div className="text-2xl font-semibold text-status-positive tabular-nums mt-1 font-mono">
              {currency.format(totals.totalNetPayout)}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">soma de todos os terapeutas do mês</div>
          </div>

          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Terapeutas no Período</span>
            <div className="text-2xl font-semibold text-gold tabular-nums mt-1 font-mono">{rows.length}</div>
            <div className="text-[11px] text-ink-soft mt-1">com contrato ativo na clínica</div>
          </div>
        </div>

        <div className="rounded-lg border border-paper-line-strong bg-white overflow-hidden shadow-sm">
          <div className="p-4 border-b border-paper-line bg-paper flex justify-between items-center">
            <h3 className="text-sm font-bold text-ink">Detalhamento por Profissional PJ</h3>
            <span className="text-xs text-ink-soft">Competência: {competenceLabel}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="bg-paper border-b border-paper-line text-ink-faint font-medium uppercase">
                <tr>
                  <th className="p-3.5">Profissional</th>
                  <th className="p-3.5">Faixa</th>
                  <th className="p-3.5 text-center">Sessões</th>
                  <th className="p-3.5 text-right">Bruto (R$)</th>
                  <th className="p-3.5 text-right">Repasse Líquido</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Extrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-paper/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-ink">{r.name}</div>
                    </td>
                    <td className="p-3.5 font-medium">{r.tier}</td>
                    <td className="p-3.5 text-center font-mono font-semibold">{r.sessionsCount}</td>
                    <td className="p-3.5 text-right font-mono">{currency.format(r.grossAmount)}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-status-positive">
                      {currency.format(r.repasseAmount)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[r.statusLabel]}`}>
                        {r.statusLabel}
                      </span>
                      {r.isLive && r.statusLabel !== "Sem sessões" && (
                        <div className="mt-1 text-[10px] text-ink-faint">calculado ao vivo</div>
                      )}
                      {!r.isLive && r.payoutId && r.statusLabel === "A pagar" && (
                        <div className="mt-1">
                          <MarkPaidButton payoutId={r.payoutId} />
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <PayoutStatementModal data={statements[i]} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-3.5 text-ink-faint">
                      Nenhum terapeuta com contrato ativo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
