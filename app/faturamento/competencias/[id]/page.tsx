import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { computeCompetenceEligibility } from "@/lib/billing-eligibility";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { ReprocessButton } from "./reprocess-button";
import { CsvExportButton } from "../csv-export-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  enviada: "Exportada",
  paga: "Paga",
};

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  return `${month}/${year}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CompetenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("billing_periods")
    .select("id, competence_month, status, insurer_id, exported_at, insurers(name)")
    .eq("id", id)
    .maybeSingle();

  if (!period) {
    notFound();
  }

  const insurerName = (period.insurers as { name: string } | null)?.name ?? "Convênio";
  const monthStr = period.competence_month.slice(0, 7);

  const { data: rawItems } = await supabase
    .from("billing_items")
    .select(
      "id, procedure_code, amount, appointments(starts_at, patients(full_name), therapist:profiles!therapist_id(full_name))",
    )
    .eq("billing_period_id", id)
    .order("id");

  const items = (rawItems ?? []).map((item) => {
    const appt = item.appointments as {
      starts_at: string;
      patients: { full_name: string } | null;
      therapist: { full_name: string } | null;
    } | null;

    return {
      id: item.id,
      procedureCode: item.procedure_code,
      amount: Number(item.amount),
      startsAt: appt?.starts_at ?? null,
      patientName: appt?.patients?.full_name ?? "Paciente",
      therapistName: appt?.therapist?.full_name ?? "Profissional",
    };
  });

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const { inconsistent } = await computeCompetenceEligibility(supabase, period.insurer_id, monthStr);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Faturamento"
        title={`${insurerName} — ${formatMonthLabel(monthStr)}`}
        description={`Status: ${STATUS_LABEL[period.status] ?? period.status}${
          period.exported_at ? ` · exportado em ${formatDateTime(period.exported_at)}` : ""
        }`}
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3">
          <p className="text-sm text-ink-soft">
            Total da competência
            <span className="tabular-figure ml-2 text-lg font-semibold text-ink">
              {formatCurrency(total)}
            </span>
          </p>
          <div className="flex gap-2">
            <ReprocessButton insurerId={period.insurer_id} monthStr={monthStr} />
            <CsvExportButton billingPeriodId={period.id} />
          </div>
        </div>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
            Itens faturáveis ({items.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">{item.patientName}</span>
                <span className="tabular-figure text-ink-soft">
                  {item.startsAt ? formatDateTime(item.startsAt) : "—"}
                </span>
                <span className="text-ink-soft">{item.procedureCode}</span>
                <span className="text-ink-faint">{item.therapistName}</span>
                <span className="tabular-figure font-medium text-ink">
                  {formatCurrency(item.amount)}
                </span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhum item faturável ainda.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-status-negative-text">
            Inconsistências ({inconsistent.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {inconsistent.map((session) => (
              <li
                key={session.appointmentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-negative-soft bg-status-negative-soft/40 px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">{session.patientName}</span>
                <span className="tabular-figure text-ink-soft">{formatDateTime(session.startsAt)}</span>
                <span className="text-status-negative-text">{session.reason}</span>
              </li>
            ))}
            {inconsistent.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhuma inconsistência nesta competência.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
