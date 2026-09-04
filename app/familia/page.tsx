import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";

export default function FamiliaPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Portal da família"
        title="Progresso do meu filho"
        description="Agenda, frequência e metas em linguagem simples — nunca a evolução clínica bruta."
      />
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-3 sm:p-10">
        <MeasurementCard label="Próxima sessão" value="—" />
        <MeasurementCard label="Frequência do mês" value="0" unit="%" />
        <MeasurementCard label="Metas em andamento" value="0" />
        <div className="sm:col-span-3">
          <TrendStrip label="Frequência — últimos 3 meses" />
        </div>
      </div>
    </main>
  );
}
