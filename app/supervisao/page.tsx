import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";

export default function SupervisaoPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Coordenação clínica"
        title="Carteira e pendências"
        description="Carteira por terapeuta, pendências clínicas, risco de evasão, qualidade."
      />
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-4 sm:p-10">
        <MeasurementCard label="Pacientes ativos" value="0" />
        <MeasurementCard label="Evoluções atrasadas" value="0" />
        <MeasurementCard label="Risco de evasão" value="0" />
        <MeasurementCard label="Ocupação de agenda" value="0" unit="%" />
        <div className="sm:col-span-4">
          <TrendStrip label="Ocupação de agenda — últimas 4 semanas" />
        </div>
      </div>
    </main>
  );
}
