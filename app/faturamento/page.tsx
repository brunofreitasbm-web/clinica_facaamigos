import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MeasurementCard } from "@/components/measurement-card";
import { TrendStrip } from "@/components/trend-strip";
import { createClient } from "@/lib/supabase/server";
import { countOverdueSessionNotes } from "@/lib/session-note-pending";

export const dynamic = "force-dynamic";

export default async function FaturamentoPage() {
  const supabase = await createClient();

  const sessionsWithoutNote = await countOverdueSessionNotes(supabase);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Faturamento"
        title="Competência atual"
        description="Sessões realizadas, guias, lotes, glosas."
      />
      <div className="grid grid-cols-1 content-start items-start gap-6 p-6 sm:grid-cols-3 sm:p-10">
        <MeasurementCard
          label="Sessões sem evolução"
          value={String(sessionsWithoutNote)}
          placeholder={false}
          status={sessionsWithoutNote > 0 ? "negative" : "positive"}
        />
        <MeasurementCard label="Glosa (competência)" value="0" unit="%" />
        <MeasurementCard label="Lote exportado" value="—" />
        <div className="sm:col-span-3">
          <TrendStrip label="Glosa — últimas 6 competências" />
        </div>
        <div className="sm:col-span-3">
          <Link
            href="/faturamento/competencias"
            className="inline-flex items-center gap-1 text-sm font-medium text-chart hover:underline"
          >
            Ver competências →
          </Link>
        </div>
      </div>
    </main>
  );
}
