import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getPendingPatients } from "@/lib/patient-stage";

const STAGE_LABEL: Record<number, string> = {
  1: "Lead sem avaliação agendada",
  2: "Avaliação agendada, aguardando",
  3: "Avaliação feita, sem autorização",
  4: "Autorizado, sem grade montada",
};

const DAYS_THRESHOLD = 3;

export const dynamic = "force-dynamic";

export default async function PendenciasPage() {
  const supabase = await createClient();

  const pending = await getPendingPatients(supabase, DAYS_THRESHOLD);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Fila de pendências"
        description={`Pacientes travados em algum estágio há ${DAYS_THRESHOLD}+ dias.`}
      />
      <div className="flex flex-col gap-2 p-6 sm:p-10">
        {pending.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhuma pendência no momento.</p>
        )}
        {pending.map((p) => (
          <a
            key={p.id}
            href={`/recepcao/pacientes/${p.id}`}
            className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm hover:border-chart"
          >
            <div>
              <p className="font-medium text-ink">{p.full_name}</p>
              <p className="text-ink-faint">{STAGE_LABEL[p.stage] ?? "Estágio desconhecido"}</p>
            </div>
            <span className="tabular-figure text-status-negative-text">{p.daysSinceCreated}d</span>
          </a>
        ))}
      </div>
    </main>
  );
}
