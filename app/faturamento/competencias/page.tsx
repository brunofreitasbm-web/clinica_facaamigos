import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { FaturamentoHeader } from "../faturamento-header";
import { CompetenceForm } from "./competence-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  enviada: "Exportada",
  paga: "Paga",
};

const STATUS_TAG_CLASS: Record<string, string> = {
  aberta: "st-agendada",
  fechada: "st-em-atendimento",
  enviada: "st-confirmada",
  paga: "st-realizada",
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
      <FaturamentoHeader active="competencia" />
      <div className="flex flex-col gap-10 px-10 py-10">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
            Faturamento · convênio + mês
          </h6>
          <h1 className="m-0">Competências</h1>
          <p className="mt-2 max-w-[640px] text-sm text-ink-soft">
            Fechamento por convênio e mês — lista sessões realizadas com evolução e gera o lote
            pro faturista.
          </p>
        </div>

        <CompetenceForm insurers={insurers ?? []} />

        <table className="table">
          <thead>
            <tr>
              <th>Convênio</th>
              <th>Competência</th>
              <th>Status</th>
              <th>Itens</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(periods ?? []).map((period) => {
              const items = (period.billing_items as { amount: number }[] | null) ?? [];
              const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
              const insurerName = (period.insurers as { name: string } | null)?.name ?? "Convênio";

              return (
                <tr key={period.id}>
                  <td className="font-semibold">
                    <Link href={`/faturamento/competencias/${period.id}`}>{insurerName}</Link>
                  </td>
                  <td className="tabular-figure">{formatCompetence(period.competence_month)}</td>
                  <td>
                    <span className={`tag-status ${STATUS_TAG_CLASS[period.status] ?? "st-cancelada"}`}>
                      {STATUS_LABEL[period.status] ?? period.status}
                    </span>
                  </td>
                  <td className="tabular-figure">{items.length}</td>
                  <td className="tabular-figure font-semibold">{formatCurrency(total)}</td>
                </tr>
              );
            })}
            {(periods ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="text-ink-faint">
                  Nenhuma competência fechada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
