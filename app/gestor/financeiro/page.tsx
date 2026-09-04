import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getRepasseRows, getGlosaRows, getFinanceiroKpis, getRevenueByMonth, getRepasseByTier } from "./data";
import { FinanceiroTabs } from "./financeiro-tabs";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function GestorFinanceiroPage() {
  const supabase = await createClient();

  const { rows: repasseRows, totalOpenPayout } = await getRepasseRows(supabase, DEV_CLINIC_ID);
  const glosaRows = await getGlosaRows(supabase, DEV_CLINIC_ID);
  const [kpis, revenueByMonth] = await Promise.all([
    getFinanceiroKpis(supabase, DEV_CLINIC_ID, totalOpenPayout, glosaRows),
    getRevenueByMonth(supabase, DEV_CLINIC_ID),
  ]);
  const tierBars = getRepasseByTier(repasseRows);

  const maxMonth = Math.max(...revenueByMonth.map((m) => m.ok + m.glosa), 1);
  const maxTier = Math.max(...tierBars.map((t) => t.amount), 1);

  return (
    <main className="flex flex-1 flex-col pb-16">
      <GestorNav active="financeiro" />

      <div className="px-10 pt-9">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          Financeiro
        </h6>
        <h1 className="m-0">Repasses e glosas</h1>
      </div>

      <section className="grid grid-cols-2 gap-6 px-10 pt-8 sm:grid-cols-4">
        <div className="card">
          <span className="card-kicker">Receita bruta</span>
          <span className="card-title tabular-figure" style={{ fontSize: 26 }}>{currency.format(kpis.receitaBruta)}</span>
          <span className="card-body">faturado no mês</span>
        </div>
        <div className="card">
          <span className="card-kicker">Repasses a pagar</span>
          <span className="card-title tabular-figure" style={{ fontSize: 26, color: "var(--color-accent-2)" }}>
            {currency.format(kpis.repassesAPagar)}
          </span>
          <span className="card-body">competência aberta</span>
        </div>
        <div className="card">
          <span className="card-kicker">Glosas em aberto</span>
          <span className="card-title tabular-figure" style={{ fontSize: 26, color: "var(--status-falta)" }}>
            {currency.format(kpis.glosasEmAberto)}
          </span>
          <span className="card-body">não recuperadas</span>
        </div>
        <div className="card">
          <span className="card-kicker">DSO médio</span>
          <span className="card-title tabular-figure" style={{ fontSize: 26 }}>
            {kpis.dsoMedioDias != null ? `${kpis.dsoMedioDias}d` : "—"}
          </span>
          <span className="card-body">envio até pagamento</span>
        </div>
      </section>

      <section className="px-10 pt-10">
        <FinanceiroTabs repasseRows={repasseRows} glosaRows={glosaRows} />
      </section>

      <section className="grid grid-cols-1 gap-15 px-10 pt-14 lg:grid-cols-2">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Receita por convênio · 6 meses
          </h6>
          <div className="flex items-end gap-4" style={{ height: 160 }}>
            {revenueByMonth.length > 0 ? (
              revenueByMonth.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-2" style={{ height: "100%" }}>
                  <div className="flex w-full flex-col-reverse" style={{ height: 120 }}>
                    <span
                      style={{
                        width: "100%",
                        height: `${((m.ok / maxMonth) * 120).toFixed(1)}px`,
                        background: "var(--color-accent)",
                        borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                      }}
                    />
                    <span
                      style={{
                        width: "100%",
                        height: `${((m.glosa / maxMonth) * 120).toFixed(1)}px`,
                        background: "var(--status-falta)",
                      }}
                    />
                  </div>
                  <span className="text-xs text-ink-faint capitalize">{m.label}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-faint">Nenhuma competência de faturamento aberta ainda.</p>
            )}
          </div>
        </div>
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4">
            Composição do repasse por faixa
          </h6>
          <div className="flex flex-col gap-3">
            {tierBars.length > 0 ? (
              tierBars.map((t) => (
                <div key={t.tier} className="grid grid-cols-[100px_1fr_90px] items-center gap-3 text-sm">
                  <span className="truncate">{t.tier}</span>
                  <span style={{ background: "var(--color-divider)", borderRadius: "var(--radius-sm)", height: 10 }}>
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${Math.max(4, (t.amount / maxTier) * 100)}%`,
                        background: "var(--color-accent-2)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    />
                  </span>
                  <span className="tabular-figure text-right">{currency.format(t.amount)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-faint">Nenhum repasse calculado neste mês.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
