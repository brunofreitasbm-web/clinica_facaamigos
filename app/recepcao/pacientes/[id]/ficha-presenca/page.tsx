import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilTimeInTimeZone, monthRangeInTimeZone, todayInTimeZone } from "@/lib/timezone";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

type PresenceSheetRpcRow = {
  appointment_id: string;
  starts_at: string;
  therapist_name: string;
  discipline: string;
  status: string;
  presence_sheet_signed_at: string | null;
  guide_signed_at: string | null;
  guide_number: string | null;
};

function currentMonthStr(): string {
  return todayInTimeZone(CLINIC_TIMEZONE).slice(0, 7);
}

export default async function FichaPresencaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? (monthParam as string) : currentMonthStr();

  const supabase = await createClient();

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", id).maybeSingle();
  if (!patient) notFound();

  const { startIso, endIso } = monthRangeInTimeZone(month, CLINIC_TIMEZONE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowsRaw } = await (supabase as any).rpc("monthly_presence_sheet", {
    p_patient_id: id,
    p_month_start: startIso,
    p_month_end: endIso,
  });

  const rows: PresenceSheetRpcRow[] = rowsRaw ?? [];

  return (
    <PageContainer>
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          <Link href={`/recepcao/pacientes/${patient.id}`}>← Ficha do paciente</Link>
        </h6>
        <h1 className="m-0">Ficha mensal de presença · {patient.full_name}</h1>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Mês</label>
          <input type="month" name="month" defaultValue={month} className="input mt-1" />
        </div>
        <button type="submit" className="btn btn-secondary text-xs">
          Ver mês
        </button>
        <a href={`/recepcao/pacientes/${patient.id}/ficha-presenca/pdf?month=${month}`} className="btn btn-primary text-xs">
          Baixar PDF
        </a>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Hora</th>
            <th>Terapeuta</th>
            <th>Especialidade</th>
            <th>Status</th>
            <th>Ficha assinada</th>
            <th>Guia assinada</th>
            <th>Nº guia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.appointment_id}>
              <td>{new Date(row.starts_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}</td>
              <td>{civilTimeInTimeZone(row.starts_at, CLINIC_TIMEZONE)}</td>
              <td>{row.therapist_name}</td>
              <td>{row.discipline}</td>
              <td>{APPOINTMENT_STATUS_STYLE[row.status]?.label ?? row.status}</td>
              <td>{row.presence_sheet_signed_at ? "Sim" : "Não"}</td>
              <td>{row.guide_signed_at ? "Sim" : "Não"}</td>
              <td>{row.guide_number ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-ink-faint">
                Nenhuma sessão nesse mês.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </PageContainer>
  );
}
