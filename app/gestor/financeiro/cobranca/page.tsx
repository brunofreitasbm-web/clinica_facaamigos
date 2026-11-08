import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { FinanceiroSubnav } from "@/components/financeiro-subnav";
import { PageContainer } from "@/components/page-container";
import { computeCollectionKpis, type Kpi } from "@/lib/payments/kpis-pure";
import { todayInSaoPaulo } from "@/lib/payments/billing-pure";

export const dynamic = "force-dynamic";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Delta legível: "▲ 2,5 pp vs mês anterior"; meta: "meta ≤ 8%". */
function Comparison({ kpi, unit, lowerIsBetter }: { kpi: Kpi; unit: "%" | "R$"; lowerIsBetter?: boolean }) {
  const fmt = (n: number) => (unit === "R$" ? brl(n) : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
  const parts: string[] = [];
  let good: boolean | null = null;
  if (kpi.previous !== null) {
    const d = kpi.value - kpi.previous;
    const arrow = d === 0 ? "=" : d > 0 ? "▲" : "▼";
    parts.push(`${arrow} ${unit === "R$" ? brl(Math.abs(d)) : `${Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pp`} vs mês anterior (${fmt(kpi.previous)})`);
    if (d !== 0) good = lowerIsBetter ? d < 0 : d > 0;
  }
  if (kpi.target !== null) {
    const ok = lowerIsBetter ? kpi.value <= kpi.target : kpi.value >= kpi.target;
    parts.push(`meta ${lowerIsBetter ? "≤" : "≥"} ${fmt(kpi.target)}`);
    good = ok;
  }
  return (
    <span className="mt-1 block text-xs" style={{ color: good === null ? "var(--color-neutral-500)" : good ? "var(--status-realizada)" : "var(--status-falta)" }}>
      {parts.join(" · ")}
    </span>
  );
}

function Card({ title, value, kpi, unit, lowerIsBetter }: { title: string; value: string; kpi: Kpi; unit: "%" | "R$"; lowerIsBetter?: boolean }) {
  return (
    <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
      <div className="mb-2 text-sm font-semibold text-ink-faint">{title}</div>
      <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{value}</div>
      <Comparison kpi={kpi} unit={unit} lowerIsBetter={lowerIsBetter} />
    </div>
  );
}

export default async function CobrancaPage() {
  const supabase = await createClient();
  const today = todayInSaoPaulo();

  const { data: contracts } = await supabase
    .from("patient_contracts")
    .select("id, status, monthly_fee, payment_method, plan_code, needs_review, needs_review_reason, patients(full_name)")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("plan_type", "particular");

  const ids = (contracts ?? []).map((c) => c.id);
  const { data: invoices } = ids.length
    ? await supabase.from("contract_invoices").select("due_date, amount, status, paid_at, payment_method").in("contract_id", ids)
    : { data: [] };

  const k = computeCollectionKpis(
    (invoices ?? []).map((i) => ({ ...i, amount: Number(i.amount) })),
    (contracts ?? []).map((c) => ({ status: c.status, monthly_fee: Number(c.monthly_fee), payment_method: c.payment_method, plan_code: c.plan_code })),
    today,
  );

  const review = (contracts ?? []).filter((c) => c.needs_review);

  const { data: problems } = await supabase
    .from("payment_events")
    .select("id, event_type, error, received_at")
    .not("error", "is", null)
    .order("received_at", { ascending: false })
    .limit(10);

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FinanceiroSubnav activeTab="cobranca" />
      <PageContainer>
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">Pacotes de Sessões</h6>
          <h1 className="m-0">Cobrança e Inadimplência</h1>
          <p className="mt-1 text-sm text-ink-faint">Pré-pago por Pix Automático e boleto. Metas conservadoras do plano de negócios (ajustar com dado real).</p>
        </div>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Receita recorrente (MRR particular)" value={brl(k.mrr.value)} kpi={k.mrr} unit="R$" />
          <Card title="Em aberto há mais de 5 dias" value={`${k.overdueAfter5Days.value.toLocaleString("pt-BR")}%`} kpi={k.overdueAfter5Days} unit="%" lowerIsBetter />
          <Card title="Perda (em aberto há mais de 60 dias)" value={`${k.finalLoss.value.toLocaleString("pt-BR")}%`} kpi={k.finalLoss} unit="%" lowerIsBetter />
          <Card title="Adesão ao Pix Automático" value={`${k.pixAdoption.value.toLocaleString("pt-BR")}%`} kpi={k.pixAdoption} unit="%" />
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Faturas em atraso por faixa (dias desde o vencimento)</h3>
          <table className="table w-full">
            <thead>
              <tr><th>Faixa</th><th>Faturas</th><th>Valor</th><th>Mês anterior (faturas)</th></tr>
            </thead>
            <tbody>
              {k.aging.map((b) => (
                <tr key={b.bucket}>
                  <td>{b.bucket} dias</td>
                  <td className="tabular-figure">{b.count}</td>
                  <td className="tabular-figure">{brl(b.amount)}</td>
                  <td className="tabular-figure text-xs text-ink-faint">{b.previousCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-faint">Meta: nenhuma fatura acima de 60 dias. A negativação e o protesto nunca são automáticos: dependem de aprovação do gestor.</p>
        </section>

        {review.length > 0 && (
          <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--status-falta)" }}>
            <h3 className="mb-4">Contratos para revisar ({review.length})</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {review.map((c) => (
                <li key={c.id}>
                  <b>{(c.patients as { full_name?: string } | null)?.full_name ?? "—"}</b>: {c.needs_review_reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(problems ?? []).length > 0 && (
          <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <h3 className="mb-4">Eventos do gateway com problema</h3>
            <ul className="flex flex-col gap-1 text-xs">
              {(problems ?? []).map((p) => (
                <li key={p.id}>
                  {new Date(p.received_at).toLocaleString("pt-BR")} · {p.event_type} · <b>{p.error}</b>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">“unmatched_payment”: pagamento recebido que não casou com nenhuma fatura; conferir no painel do gateway e dar baixa manual com motivo.</p>
          </section>
        )}
      </PageContainer>
    </main>
  );
}
