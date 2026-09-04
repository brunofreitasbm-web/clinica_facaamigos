import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getLeakCards, getBonusRows, getTierProgression, currentMonthRange } from "./data";
import { ExecutiveLeaks } from "./executive-leaks";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BONUS_STATUS_TAG: Record<string, string> = {
  atingida: "st-realizada",
  perto: "st-agendada",
  abaixo: "st-falta",
};
const BONUS_STATUS_LABEL: Record<string, string> = {
  atingida: "Atingida",
  perto: "Perto",
  abaixo: "Abaixo",
};

export default async function GestorPage() {
  const supabase = await createClient();

  // Consultas já existentes na home anterior (pacientes ativos, concentração
  // de convênio) — mantidas e agora exibidas como contexto no topo do
  // painel executivo, em vez de measurement-cards soltos.
  const { count: activePatientsCount } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("status", "ativo");

  const { data: insuranceRows } = await supabase
    .from("patient_insurance")
    .select("patient_id, insurer_id, patients!inner(status, clinic_id)")
    .eq("patients.status", "ativo")
    .eq("patients.clinic_id", DEV_CLINIC_ID)
    .eq("is_private", false)
    .not("insurer_id", "is", null);

  const insurerByPatient = new Map<string, string>();
  for (const row of insuranceRows ?? []) {
    if (row.insurer_id && !insurerByPatient.has(row.patient_id)) {
      insurerByPatient.set(row.patient_id, row.insurer_id);
    }
  }
  const totalWithInsurer = insurerByPatient.size;
  const countsByInsurer = new Map<string, number>();
  for (const insurerId of insurerByPatient.values()) {
    countsByInsurer.set(insurerId, (countsByInsurer.get(insurerId) ?? 0) + 1);
  }
  const topInsurerCount = Math.max(0, ...countsByInsurer.values());
  const hasConcentrationData = totalWithInsurer > 0;
  const concentrationPct = hasConcentrationData ? Math.round((topInsurerCount / totalWithInsurer) * 100) : null;

  const [leaks, bonusRows, tierRows] = await Promise.all([
    getLeakCards(supabase, DEV_CLINIC_ID),
    getBonusRows(supabase, DEV_CLINIC_ID),
    getTierProgression(supabase, DEV_CLINIC_ID),
  ]);

  const { startISO, endISO } = currentMonthRange();
  const { data: insurers } = await supabase.from("insurers").select("id").eq("clinic_id", DEV_CLINIC_ID);
  const insurerIds = (insurers ?? []).map((i) => i.id);
  let receitaPrevista = 0;
  if (insurerIds.length > 0) {
    const { data: periods } = await supabase
      .from("billing_periods")
      .select("id")
      .in("insurer_id", insurerIds)
      .gte("competence_month", startISO.slice(0, 10))
      .lt("competence_month", endISO.slice(0, 10));
    const periodIds = (periods ?? []).map((p) => p.id);
    if (periodIds.length > 0) {
      const { data: items } = await supabase.from("billing_items").select("amount").in("billing_period_id", periodIds);
      receitaPrevista = (items ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
    }
  }
  const vazamentoTotal = leaks.reduce((sum, l) => sum + (l.amountValue ?? 0), 0);

  const bonusPanel = (
    <div>
      <h6 style={{ color: "var(--color-accent-2-600)" }}>Bonificação por cargo</h6>
      <h3 className="mb-5">Metas do mês</h3>
      <div className="flex flex-col gap-5">
        {bonusRows.map((row) => (
          <div key={row.role}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{row.role}</span>
              <span className={`tag-status ${BONUS_STATUS_TAG[row.status]}`}>{BONUS_STATUS_LABEL[row.status]}</span>
            </div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px] text-ink-soft">
              <span>{row.metricLabel}</span>
              <span className="tabular-figure">{row.actualLabel}</span>
            </div>
            <span style={{ display: "block", background: "var(--color-divider)", borderRadius: "var(--radius-sm)", height: 8 }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${row.progressPct}%`,
                  background: "var(--color-accent-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4 border-t pt-6" style={{ borderColor: "var(--color-divider)" }}>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Receita prevista</div>
          <div className="tabular-figure text-lg font-semibold">{currency.format(receitaPrevista)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Vazamento total (estimado)</div>
          <div className="tabular-figure text-lg font-semibold" style={{ color: "var(--status-falta)" }}>
            {currency.format(vazamentoTotal)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Bonificação a pagar</div>
          <div className="tabular-figure text-lg font-semibold" style={{ color: "var(--color-accent-2)" }}>
            —
          </div>
          <div className="text-[11px] text-ink-faint">sem tabela de salário-base cadastrada</div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active={null} />

      <div className="flex flex-wrap items-end justify-between gap-6 px-10 pt-9">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
            Painel executivo
          </h6>
          <h1 className="m-0">Metas por cargo e vazamentos de receita</h1>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Pacientes ativos</div>
            <div className="tabular-figure text-2xl font-semibold">{activePatientsCount ?? 0}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Concentração maior convênio</div>
            <div className="tabular-figure text-2xl font-semibold">
              {concentrationPct != null ? `${concentrationPct}%` : "—"}
            </div>
          </div>
        </div>
      </div>

      <ExecutiveLeaks leaks={leaks} bonusPanel={bonusPanel} />

      <section className="px-10 pt-14">
        <h6 style={{ color: "var(--color-accent-2-600)" }}>Terapeutas</h6>
        <h3 className="mb-5">Progressão de faixa</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Terapeuta</th>
              <th>Faixa</th>
              <th>Sessões (90d)</th>
              <th>Evolução em 24h</th>
              <th>Faltas recuperadas</th>
              <th>Próxima faixa</th>
            </tr>
          </thead>
          <tbody>
            {tierRows.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold">{t.name}</td>
                <td>{t.tier}</td>
                <td className="tabular-figure">{t.sessions}</td>
                <td className="tabular-figure">{t.note24hRateLabel}</td>
                <td className="tabular-figure">{t.faltasRecuperadasLabel}</td>
                <td>{t.nextTierLabel}</td>
              </tr>
            ))}
            {tierRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-ink-faint">
                  Nenhum terapeuta ativo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
