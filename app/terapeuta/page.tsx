import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";

export default function TerapeutaPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title="Minhas sessões de hoje"
        description="Evoluções pendentes aparecem primeiro — meta é registrar em até 2 minutos."
      />
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-3 sm:p-10">
        <MeasurementCard label="Sessões hoje" value="0" />
        <MeasurementCard label="Evolução pendente" value="0" />
        <MeasurementCard label="Metas atingidas (trimestre)" value="0" unit="%" />
        <div className="sm:col-span-3">
          <TrendStrip label="Metas atingidas — últimos 3 trimestres" />
        </div>
      </div>
    </main>
  );
}
