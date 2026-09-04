import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GestorPage() {
  const supabase = await createClient();

  const { count: activePatientsCount } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativo");

  // Concentração do maior convênio: entre pacientes ativos com convênio
  // vinculado (particular não conta), qual insurer_id concentra mais
  // pacientes, como % do total de pacientes ativos COM convênio.
  const { data: insuranceRows } = await supabase
    .from("patient_insurance")
    .select("patient_id, insurer_id, patients!inner(status)")
    .eq("patients.status", "ativo")
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
  const concentrationPct = hasConcentrationData
    ? Math.round((topInsurerCount / totalWithInsurer) * 100)
    : 0;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Gestor"
        title="Painel executivo"
        description="Metas por cargo, bonificação, indicadores financeiros — sem planilha manual."
      />
      <nav className="flex flex-col gap-2 px-6 sm:px-10">
        <Link
          href="/gestor/convenios"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Gerenciar convênios
        </Link>
      </nav>
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-4 sm:p-10">
        <MeasurementCard label="Pacientes ativos" value={String(activePatientsCount ?? 0)} placeholder={false} />
        <MeasurementCard label="Glosa (mês)" value="0" unit="%" />
        <MeasurementCard
          label="Concentração maior convênio"
          value={String(concentrationPct)}
          unit="%"
          placeholder={!hasConcentrationData}
        />
        <MeasurementCard label="Metas atingidas (equipe)" value="0" unit="%" />
        <div className="sm:col-span-4">
          <TrendStrip label="Receita líquida — últimos 6 meses" />
        </div>
      </div>
    </main>
  );
}
