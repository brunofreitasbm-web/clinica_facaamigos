import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { PriceTableForm } from "./price-table-form";

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
    .select("id, procedure_code, procedure_name, price, valid_from, valid_to")
    .eq("insurer_id", insurerId)
    .order("procedure_code");

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Gestor"
        title={`Tabela de preços — ${insurer.name}`}
        description="Preços por procedimento usados no fechamento de competência deste convênio."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
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
              <div className="flex items-center gap-3 text-ink-soft">
                <span className="font-medium text-ink">{currencyFormatter.format(entry.price)}</span>
                <span className="text-ink-faint">
                  {formatDate(entry.valid_from)} até{" "}
                  {entry.valid_to ? formatDate(entry.valid_to) : "sem prazo"}
                </span>
              </div>
            </li>
          ))}
          {(priceTables ?? []).length === 0 && (
            <li className="text-sm text-ink-faint">Nenhum preço cadastrado ainda.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
