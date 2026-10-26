import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import {
  getReceptionQueue,
  getAuthorizationWizardItems,
  isAuthorizationQueueItem,
  isPendingQueueItem,
  type PendingQueueCategory,
} from "@/lib/reception-queue";
import { AutorizacaoWizard } from "./autorizacao-wizard";
import { PageContainer } from "@/components/page-container";
import { QueueWorkspace, type QueueStage } from "./queue-workspace";
import { buildWorkspaceItems } from "./queue-items";

export const dynamic = "force-dynamic";

/**
 * Ordem das categorias no filtro "Tipo". Toda categoria de PendingQueueCategory
 * precisa estar aqui: getReceptionQueue conta o que falta no badge do menu, e
 * uma categoria esquecida aqui some do filtro (foi o que aconteceu com
 * cadastro_assistido_ia e chegada_nao_confirmada até 20/09/2026). A ordem da
 * LISTA é por urgência (faixas Agora/Hoje/Depois em queue-workspace.tsx).
 */
const CATEGORY_ORDER: PendingQueueCategory[] = [
  // Tem gente esperando no balcão agora (prazo de 15min em
  // DUE_MINUTES_BY_CATEGORY) — sempre cai na faixa "Agora".
  "chegada_nao_confirmada",
  // O que chega pelo WhatsApp fora do expediente — ponto de partida de quem
  // abre a clínica (20/09/2026, quando a aba "Cadastro IA" saiu da navegação).
  "cadastro_assistido_ia",
  "guia_vencendo",
  "guia_poucas_sessoes",
  "cadastro_incompleto",
  "evolucao_atrasada",
  "documento_vencido",
  "interessado_sem_retorno",
  "falta_sem_motivo",
  "remarcacao_solicitada",
  "renovacao_solicitada",
];

const QUEUE_STAGES: QueueStage[] = ["docs", "autorizacao", "agendar", "liberado"];


export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; item?: string; q?: string; tipo?: string; etapa?: string; dono?: string; meus?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const fullQueue = await getReceptionQueue(supabase);
  // Lead que só espera o plano mora em /recepcao/a-autorizar; links antigos (?lead=) seguem para lá.
  const movedLead = params.lead ? fullQueue.find((item) => item.draft?.id === params.lead && isAuthorizationQueueItem(item)) : undefined;
  if (movedLead) redirect(`/recepcao/a-autorizar?item=${encodeURIComponent(movedLead.id)}`);
  const queue = fullQueue.filter(isPendingQueueItem);
  const authorizations = await getAuthorizationWizardItems(supabase, DEV_CLINIC_ID);

  // Candidatos pra reatribuição manual (§9.1 "dono + prazo"): mesmo conjunto
  // de papéis que pode ler/escrever pending_queue_assignments
  // (recepcao/supervisor/gestor) — não só recepção, pra um item escalado
  // poder ser assumido por supervisor/gestor sem depender de outra recepção.
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

  // ?lead=<draftId> — chegada pelo botão "Resolver pendências" do Atendimento
  // (app/recepcao/atendimento/lead-context-panel.tsx): abre o contato no painel.
  // O item pode não estar mais na fila (resolvido entre o clique e a navegação).
  const leadItem = params.lead ? queue.find((item) => item.draft?.id === params.lead) : undefined;
  const requestedItem = params.item && queue.some((item) => item.id === params.item) ? params.item : null;

  // Guia com renovação já pedida não conta como crítica: está aguardando o plano.
  const critical = authorizations.filter((a) => a.status === "critical" && !a.renewal).length;
  const attention = authorizations.filter((a) => a.status === "attention" && !a.renewal).length;
  const awaitingInsurer = authorizations.filter((a) => a.renewal).length;

  const items = buildWorkspaceItems(queue, { reassignCandidates, userId: user?.id ?? null });

  const etapa = QUEUE_STAGES.includes(params.etapa as QueueStage) ? (params.etapa as QueueStage) : null;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Pendências"
        description="Pendências de pacientes com prontuário: documento vencido, guia vencendo, faltas e remarcações. Leads do WhatsApp ficam em Autorizações."
      />
      <PageContainer className="gap-5">
        {authorizations.length > 0 && (
          <details className="group rounded-lg bg-paper-surface shadow-sm">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-5 py-4 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-5 w-5 text-ink-soft transition-transform group-open:rotate-90" aria-hidden="true" />
              <span className="font-bold text-ink">Pacotes de horas autorizadas</span>
              {critical > 0 && (
                <span className="rounded-full bg-status-negative-soft px-3 py-0.5 text-sm font-bold text-status-negative-text">
                  {critical} {critical === 1 ? "crítico" : "críticos"}
                </span>
              )}
              {attention > 0 && (
                <span className="rounded-full bg-status-pending-soft px-3 py-0.5 text-sm font-bold text-status-pending-text">
                  {attention} em atenção
                </span>
              )}
              {awaitingInsurer > 0 && (
                <span className="rounded-full bg-paper px-3 py-0.5 text-sm font-bold text-ink-soft">
                  {awaitingInsurer} aguardando o plano
                </span>
              )}
              {critical === 0 && attention === 0 && awaitingInsurer === 0 && (
                <span className="rounded-full bg-status-positive-soft px-3 py-0.5 text-sm font-bold text-status-positive-text">
                  em dia
                </span>
              )}
              <span className="ml-auto text-sm text-ink-soft">
                {authorizations.length} {authorizations.length === 1 ? "pacote ativo" : "pacotes ativos"}
              </span>
            </summary>
            <div className="border-t border-paper-line px-5 py-5">
              <AutorizacaoWizard initialItems={authorizations} />
            </div>
          </details>
        )}
        {params.lead && !leadItem && (
          <p className="m-0 rounded-md bg-paper-surface px-4 py-3 text-[15px] text-ink shadow-sm">
            Este contato não tem mais pendências abertas.
          </p>
        )}
        {queue.length === 0 ? (
          <div className="rounded-lg bg-paper-surface px-6 py-10 text-center shadow-sm">
            <p className="m-0 text-lg font-bold text-ink">Nenhuma pendência no momento.</p>
            <p className="m-0 mt-1 text-[15px] text-ink-soft">Quando algo precisar da recepção, aparece aqui por ordem de urgência.</p>
          </div>
        ) : (
          <QueueWorkspace
            items={items}
            categoryOrder={CATEGORY_ORDER}
            owners={(reassignCandidates ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
            initial={{
              q: params.q ?? "",
              tipo: params.tipo && CATEGORY_ORDER.includes(params.tipo as PendingQueueCategory) ? params.tipo : null,
              etapa,
              dono: params.dono ?? null,
              meus: params.meus === "1",
              item: leadItem?.id ?? requestedItem,
            }}
          />
        )}
      </PageContainer>
    </main>
  );
}
