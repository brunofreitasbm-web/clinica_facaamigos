import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getReceptionQueue, type PendingQueueCategory } from "@/lib/reception-queue";
import { RegisterContactButton } from "./register-contact-button";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: PendingQueueCategory[] = [
  "guia_vencendo",
  "guia_poucas_sessoes",
  "cadastro_incompleto",
  "evolucao_atrasada",
  "documento_vencido",
  "lead_sem_retorno",
];

export default async function PendenciasPage() {
  const supabase = await createClient();
  const queue = await getReceptionQueue(supabase);

  const byCategory = new Map<PendingQueueCategory, typeof queue>();
  for (const item of queue) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Fila de pendências"
        description="§9.1 do PRD: guia vencendo, guia com poucas sessões, cadastro incompleto, evolução pendente > 24h, documento vencido e lead sem retorno — tudo numa fila só, por urgência."
      />
      <div className="flex flex-col gap-8 p-6 sm:p-10">
        {queue.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhuma pendência no momento. 🎉</p>
        )}
        {CATEGORY_ORDER.map((category) => {
          const items = byCategory.get(category);
          if (!items || items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {items[0].categoryLabel} ({items.length})
              </h2>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
                  >
                    {item.patientId ? (
                      <Link href={item.href} className="min-w-0 flex-1 no-underline">
                        <p className="font-medium text-ink">{item.patientName}</p>
                        <p className="text-ink-faint">{item.detail}</p>
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{item.patientName}</p>
                        <p className="text-ink-faint">{item.detail}</p>
                      </div>
                    )}
                    {category === "lead_sem_retorno" && item.patientId ? (
                      <RegisterContactButton patientId={item.patientId} />
                    ) : (
                      <span className="tabular-figure whitespace-nowrap text-status-negative-text">
                        {item.urgencyLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
