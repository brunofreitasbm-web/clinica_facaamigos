import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";

export default function GestorPage() {
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
        <MeasurementCard label="Pacientes ativos" value="0" />
        <MeasurementCard label="Glosa (mês)" value="0" unit="%" />
        <MeasurementCard label="Concentração maior convênio" value="0" unit="%" />
        <MeasurementCard label="Metas atingidas (equipe)" value="0" unit="%" />
        <div className="sm:col-span-4">
          <TrendStrip label="Receita líquida — últimos 6 meses" />
        </div>
      </div>
    </main>
  );
}
