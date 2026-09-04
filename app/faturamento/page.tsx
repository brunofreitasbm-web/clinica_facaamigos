import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";

export default function FaturamentoPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Faturamento"
        title="Competência atual"
        description="Sessões realizadas, guias, lotes, glosas."
      />
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-3 sm:p-10">
        <MeasurementCard label="Sessões sem evolução" value="0" />
        <MeasurementCard label="Glosa (competência)" value="0" unit="%" />
        <MeasurementCard label="Lote exportado" value="—" />
        <div className="sm:col-span-3">
          <TrendStrip label="Glosa — últimas 6 competências" />
        </div>
      </div>
    </main>
  );
}
