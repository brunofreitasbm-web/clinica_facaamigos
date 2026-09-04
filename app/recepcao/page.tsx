import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";

export default function RecepcaoPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Agenda do dia"
        description="Coluna esquerda: agenda por sala. Coluna direita: fila de pendências por urgência."
      />
      <nav className="flex flex-col gap-2 px-6 sm:px-10">
        <Link
          href="/recepcao/agenda"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Ver agenda do dia
        </Link>
        <Link
          href="/recepcao/pacientes"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Ver todos os pacientes
        </Link>
        <Link
          href="/recepcao/pacientes/pendencias"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Fila de pendências
        </Link>
        <Link
          href="/recepcao/pacientes/novo"
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Novo paciente (lead)
        </Link>
      </nav>
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-3 sm:p-10">
        <MeasurementCard label="Sessões hoje" value="0" />
        <MeasurementCard label="A confirmar" value="0" />
        <MeasurementCard label="Pendências" value="0" />
        <div className="sm:col-span-3">
          <TrendStrip label="No-show — últimas 4 semanas" />
        </div>
      </div>
    </main>
  );
}
