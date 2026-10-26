import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getReceptionQueue } from "@/lib/reception-queue";
import { QueueWorkspace, type QueueStage } from "../pacientes/pendencias/queue-workspace";
import { buildWorkspaceItems } from "../pacientes/pendencias/queue-items";

export const dynamic = "force-dynamic";

const QUEUE_STAGES: QueueStage[] = ["docs", "autorizacao", "agendar"];

/**
 * "À autorizar": todo lead vindo do WhatsApp que ainda não passou pelo plano de
 * saúde — documentos e dados captados pelo bot, mais a linha do tempo da
 * autorização (guia enviada → plano autorizou → habilitar agendamento). É o
 * mesmo painel de contato da Fila de pendências (DraftIntakeCard), só que
 * recortado para essa etapa. Quem a Supervisão devolveu volta aqui com o motivo.
 */
export default async function AAutorizarPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; q?: string; etapa?: string; dono?: string; meus?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const queue = (await getReceptionQueue(supabase)).filter((item) => {
    const draft = item.draft;
    if (!draft || draft.source !== "whatsapp") return false;
    if (draft.pipeline.schedulingEnabledAt) return false;
    return true;
  });

  const { data: reassignCandidates } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("active", true)
    .in("role", ["recepcao", "supervisor", "gestor"])
    .order("full_name", { ascending: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const items = buildWorkspaceItems(queue, { reassignCandidates, userId: user?.id ?? null });
  const etapa = QUEUE_STAGES.includes(params.etapa as QueueStage) ? (params.etapa as QueueStage) : null;
  const requestedItem = params.item && queue.some((item) => item.id === params.item) ? params.item : null;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="À autorizar"
        description="Leads do WhatsApp com os documentos e dados captados, aguardando a autorização do plano de saúde."
      />
      <PageContainer className="gap-5">
        {queue.length === 0 ? (
          <div className="rounded-lg bg-paper-surface px-6 py-10 text-center shadow-sm">
            <p className="m-0 text-lg font-bold text-ink">Nenhum lead aguardando autorização.</p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">Quando um contato do WhatsApp enviar documentos, ele aparece aqui.</p>
          </div>
        ) : (
          <QueueWorkspace
            items={items}
            categoryOrder={["cadastro_assistido_ia"]}
            owners={(reassignCandidates ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
            initial={{ q: params.q ?? "", tipo: null, etapa, dono: params.dono ?? null, meus: params.meus === "1", item: requestedItem }}
          />
        )}
      </PageContainer>
    </main>
  );
}
