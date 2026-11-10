import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { loadFila } from "@/lib/fila/load-fila";
import { FilaWorkspace } from "./fila-workspace";

export const dynamic = "force-dynamic";

/**
 * Fila de entrada: famílias novas do WhatsApp, do primeiro contato até o ok de agendamento. Cada família
 * está em UM grupo e tem UM próximo passo (lib/fila/fila-model-pure.ts). Fica ao lado de Autorizações até a
 * recepção confirmar que nada faltou; as ações são as mesmas (draft-pipeline-actions, document-request-actions).
 */
export default async function FilaPage({
  searchParams,
}: {
  // ?item=<id do item ou do rascunho>: abre direto na família (links do Chat e de outras telas).
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.item) ? params.item[0] : params.item;
  const { items, hiddenCount, owners, userId } = await loadFila(await createClient());
  const initialSelectedId = requested ? (items.find((i) => i.id === requested || i.draftId === requested)?.id ?? null) : null;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Fila de entrada"
        description="Famílias novas, do primeiro contato até a primeira sessão agendada."
        descriptionVisible
      />
      <PageContainer className="gap-4">
        {hiddenCount > 0 && (
          <p className="m-0 text-sm text-ink-soft">
            {hiddenCount} {hiddenCount === 1 ? "família oculta" : "famílias ocultas"}: conversa já encerrada e sem guia em andamento. Voltam
            sozinhas se a família escrever de novo.
          </p>
        )}
        <FilaWorkspace items={items} owners={owners} userId={userId} initialSelectedId={initialSelectedId} />
      </PageContainer>
    </main>
  );
}
