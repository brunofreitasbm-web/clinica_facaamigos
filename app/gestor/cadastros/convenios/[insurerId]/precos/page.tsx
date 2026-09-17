import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { PriceTableForm } from "./price-table-form";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function TabelaDePrecosPage({
  params,
}: {
  params: Promise<{ insurerId: string }>;
}) {
  const { insurerId } = await params;
  const supabase = await createClient();

  const { data: insurer, error: insurerError } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("id", insurerId)
    .maybeSingle();

  if (!insurer || insurerError) notFound();

  const { data: priceTables } = await supabase
    .from("insurer_price_tables")
    .select(
      "id, procedure_code, procedure_name, price, valid_from, valid_to, duration_minutes, requires_prior_authorization, max_sessions_per_guide, medical_order_validity_months, guide_validity_days, session_frequency_note, escalation_rule",
    )
    .eq("insurer_id", insurerId)
    .order("procedure_code");

  const { data: glosaReasons } = await supabase
    .from("glosa_reason_catalog")
    .select("id, code, description, prevention_hint")
    .eq("insurer_id", insurerId)
    .eq("active", true)
    .order("code");

  return (
    <main className="flex flex-1 flex-col">
      <div className="px-6 pt-6 sm:px-10 sm:pt-9">
        <Link href="/gestor/cadastros/convenios" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Planos de Saúde
        </Link>
      </div>
      <PageHeader
        axisLabel="Cadastros"
        title={`Tabela de preços — ${insurer.name}`}
        description="Preços por procedimento usados no fechamento de competência deste plano de saúde."
      />
      <PageContainer>
        <PriceTableForm insurerId={insurer.id} />
        <ul className="flex flex-col gap-2">
          {(priceTables ?? []).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium text-ink">{entry.procedure_code}</span>
                <span className="ml-2 text-ink">{entry.procedure_name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-ink-soft">
                <span className="font-medium text-ink">{currencyFormatter.format(entry.price)}</span>
                <span className="text-ink-faint">
                  {formatDate(entry.valid_from)} até{" "}
                  {entry.valid_to ? formatDate(entry.valid_to) : "sem prazo"}
                </span>
                {entry.duration_minutes && <span className="text-ink-faint">{entry.duration_minutes} min</span>}
                {entry.requires_prior_authorization && (
                  <span className="rounded-full bg-status-negative-text/10 px-2 py-0.5 text-xs text-status-negative-text">
                    Exige autorização prévia
                  </span>
                )}
                {entry.max_sessions_per_guide && (
                  <span className="text-ink-faint">{entry.max_sessions_per_guide} sessões/guia</span>
                )}
                {entry.guide_validity_days && (
                  <span className="text-ink-faint">guia válida {entry.guide_validity_days}d</span>
                )}
              </div>
              {(entry.session_frequency_note || entry.escalation_rule) && (
                <div className="w-full basis-full text-xs text-ink-faint">
                  {entry.session_frequency_note && <p>⚠ {entry.session_frequency_note}</p>}
                  {entry.escalation_rule && <p>⚠ {entry.escalation_rule}</p>}
                </div>
              )}
            </li>
          ))}
          {(priceTables ?? []).length === 0 && (
            <li className="text-sm text-ink-faint">Nenhum preço cadastrado ainda.</li>
          )}
        </ul>

        {(glosaReasons ?? []).length > 0 && (
          <section className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5">
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
              Motivos de glosa deste convênio (referência)
            </h2>
            <p className="text-xs text-ink-soft">
              Usados como sugestão ao registrar glosa em{" "}
              <Link href="/faturamento/glosas" className="underline">
                Faturamento › Glosas
              </Link>
              . Não bloqueiam nada — servem pra padronizar o motivo e lembrar como evitá-lo.
            </p>
            <ul className="flex flex-col gap-2">
              {(glosaReasons ?? []).map((reason) => (
                <li key={reason.id} className="rounded-md border border-paper-line-strong bg-paper px-4 py-3 text-sm">
                  <div className="font-medium text-ink">
                    {reason.code} — {reason.description}
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">Como evitar: {reason.prevention_hint}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
    </main>
  );
}
