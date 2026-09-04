import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeCompetenceEligibility } from "@/lib/billing-eligibility";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { FaturamentoHeader } from "../../faturamento-header";
import { ReprocessButton } from "./reprocess-button";
import { CsvExportButton } from "../csv-export-button";

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
      <FaturamentoHeader active="competencia" />
      <div className="flex flex-col gap-10 px-10 py-10">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Competência · {formatMonthLabel(monthStr)}
              {period.exported_at ? ` · exportado em ${formatDateTime(period.exported_at)}` : ""}
            </h6>
            <h1 className="m-0">{insurerName}</h1>
            <span className={`tag-status mt-2 inline-flex ${STATUS_TAG_CLASS[period.status] ?? "st-cancelada"}`}>
              {STATUS_LABEL[period.status] ?? period.status}
            </span>
          </div>
          <div className="flex gap-2.5">
            <ReprocessButton insurerId={period.insurer_id} monthStr={monthStr} />
            <CsvExportButton billingPeriodId={period.id} />
          </div>
        </section>

        <section className="card w-fit min-w-[260px]">
          <div className="card-kicker">Total da competência</div>
          <div
            className="tabular-figure text-[32px] font-semibold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {formatCurrency(total)}
          </div>
        </section>

        <section>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Itens faturáveis ({items.length})
          </h6>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Data</th>
                <th>Procedimento</th>
                <th>Profissional</th>
                <th>Prontuário</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold">{item.patientName}</td>
                  <td className="tabular-figure">{item.startsAt ? formatDateTime(item.startsAt) : "—"}</td>
                  <td>{item.procedureCode}</td>
                  <td className="text-ink-faint">{item.therapistName}</td>
                  <td>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      Evolução Assinada
                    </span>
                  </td>
                  <td className="tabular-figure font-semibold">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ink-faint">
                    Nenhum item faturável ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h6 style={{ color: "var(--status-falta)" }} className="mb-3">
            Inconsistências ({inconsistent.length})
          </h6>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Data</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {inconsistent.map((session) => (
                <tr key={session.appointmentId}>
                  <td className="font-semibold">{session.patientName}</td>
                  <td className="tabular-figure">{formatDateTime(session.startsAt)}</td>
                  <td style={{ color: "var(--status-falta)" }}>{session.reason}</td>
                </tr>
              ))}
              {inconsistent.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-ink-faint">
                    Nenhuma inconsistência nesta competência.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
