import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { CompetenceForm } from "./competence-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  enviada: "Exportada",
  paga: "Paga",
};

function formatCompetence(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  return `${month}/${year}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CompetenciasPage() {
  const supabase = await createClient();

  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const { data: periods } = await supabase
    .from("billing_periods")
    .select("id, competence_month, status, insurers(name), billing_items(amount)")
    .order("competence_month", { ascending: false });

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Faturamento"
        title="Competências"
        description="Fechamento por convênio e mês — lista sessões realizadas com evolução e gera o lote pro faturista."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <CompetenceForm insurers={insurers ?? []} />

        <ul className="flex flex-col gap-2">
          {(periods ?? []).map((period) => {
            const items = (period.billing_items as { amount: number }[] | null) ?? [];
            const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
            const insurerName = (period.insurers as { name: string } | null)?.name ?? "Convênio";

            return (
              <li key={period.id}>
                <Link
                  href={`/faturamento/competencias/${period.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm hover:border-chart"
                >
                  <span className="font-medium text-ink">{insurerName}</span>
                  <span className="tabular-figure text-ink-soft">
                    {formatCompetence(period.competence_month)}
                  </span>
                  <span className="text-ink-faint">{STATUS_LABEL[period.status] ?? period.status}</span>
                  <span className="tabular-figure text-ink-faint">{items.length} itens</span>
                  <span className="tabular-figure font-medium text-ink">{formatCurrency(total)}</span>
                </Link>
              </li>
            );
          })}
          {(periods ?? []).length === 0 && (
            <li className="text-sm text-ink-faint">Nenhuma competência fechada ainda.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
