import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import {
  getReceptionQueue,
  getAuthorizationWizardItems,
  type PendingQueueCategory,
  type PendingQueueItem,
} from "@/lib/reception-queue";
import { fmtDueShort } from "@/lib/format";
import { RegisterContactButton } from "./register-contact-button";
import { ResolveAutoFaltaButton } from "./resolve-auto-falta-button";
import { ResolveSimpleButton } from "./resolve-simple-button";
import { ResolveRenewalRequestButton } from "./resolve-renewal-request-button";
import { ReassignOwnerButton } from "./reassign-owner-button";
import { resolveRescheduleRequest, reviewFamilyDocument } from "./actions";
import { AutorizacaoWizard } from "./autorizacao-wizard";
import { DraftIntakeCard } from "./draft-intake-card";
import { DraftPipelineMini } from "./draft-pipeline";
import { SummaryChip } from "./pendency-pills";
import { PageContainer } from "@/components/page-container";
import { QueueWorkspace, type QueueStage, type WorkspaceItem } from "./queue-workspace";
import { normalizeSearch, urgencyBand } from "./queue-filters-pure";

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
  "documento_familia_novo",
  "renovacao_solicitada",
];

const QUEUE_STAGES: QueueStage[] = ["docs", "autorizacao", "agendar", "liberado"];

function draftStage(item: PendingQueueItem): QueueStage | null {
  if (!item.draft) return null;
  const pipeline = item.draft.pipeline;
  if (item.draft.pendencies.missingCount > 0) return "docs";
  if (pipeline?.schedulingEnabledAt) return "liberado";
  if (pipeline?.authorization === "autorizada" || pipeline?.authorization === "dispensada") return "agendar";
  return "autorizacao";
}

function dueText(item: PendingQueueItem): string {
  if (item.escalatedAt) return `escalado ${fmtDueShort(item.escalatedAt, CLINIC_TIMEZONE)}`;
  if (item.overdue && item.dueAt) return `atrasado · ${fmtDueShort(item.dueAt, CLINIC_TIMEZONE)}`;
  if (item.dueAt) return fmtDueShort(item.dueAt, CLINIC_TIMEZONE);
  return item.urgencyLabel;
}

/** Ação que resolve a pendência ali mesmo; `null` quando o caminho é abrir a ficha. */
function primaryAction(item: PendingQueueItem) {
  const { category } = item;
  if (category === "interessado_sem_retorno" && item.patientId) return <RegisterContactButton patientId={item.patientId} />;
  if (category === "falta_sem_motivo" && item.appointmentId) return <ResolveAutoFaltaButton appointmentId={item.appointmentId} />;
  if (category === "remarcacao_solicitada" && item.rescheduleRequestId)
    return (
      <ResolveSimpleButton
        id={item.rescheduleRequestId}
        label="Marcar como concluído"
        doneLabel="Concluído"
        action={resolveRescheduleRequest}
      />
    );
  if (category === "documento_familia_novo" && item.documentId)
    return (
      <ResolveSimpleButton id={item.documentId} label="Marcar como revisado" doneLabel="Revisado" action={reviewFamilyDocument} />
    );
  if (category === "renovacao_solicitada" && item.renewalRequestId)
    return <ResolveRenewalRequestButton requestId={item.renewalRequestId} />;
  return null;
}

export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; item?: string; q?: string; tipo?: string; etapa?: string; dono?: string; meus?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const queue = await getReceptionQueue(supabase);
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

  const now = new Date();
  // Guia com renovação já pedida não conta como crítica: está aguardando o plano.
  const critical = authorizations.filter((a) => a.status === "critical" && !a.renewal).length;
  const attention = authorizations.filter((a) => a.status === "attention" && !a.renewal).length;
  const awaitingInsurer = authorizations.filter((a) => a.renewal).length;

  const items: WorkspaceItem[] = queue.map((item) => {
    const draft = item.draft;
    const escalated = Boolean(item.escalatedAt);
    const overdue = escalated || Boolean(item.overdue);
    const stage = draftStage(item);
    const action = primaryAction(item);
    const due = dueText(item);

    const detail = (
      <article key={item.id} className="flex flex-col gap-5">
        <header className="flex flex-col gap-2 border-b border-paper-line pb-4">
          <h2 className="m-0 text-2xl font-extrabold leading-tight text-ink">{item.patientName}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-paper-line-strong px-3 py-1 font-semibold text-ink">{item.categoryLabel}</span>
            {draft && <SummaryChip pendencies={draft.pendencies} />}
            {draft && <DraftPipelineMini pipeline={draft.pipeline} />}
          </div>
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-soft">
            <span>
              Dono: <strong className="text-ink">{item.assignedToName ?? "Sem dono"}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className={overdue ? "font-bold text-status-negative-text" : undefined}>
              {item.dueAt || escalated ? due : "sem prazo"}
            </span>
            {reassignCandidates && reassignCandidates.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <ReassignOwnerButton
                  itemId={item.id}
                  currentAssigneeId={item.assignedToId ?? null}
                  candidates={reassignCandidates}
                />
              </>
            )}
          </p>
        </header>

        <p className="m-0 text-base leading-relaxed text-ink">{item.detail}</p>

        {!draft && (
          <div className="flex flex-wrap items-center gap-3">
            {action}
            {item.patientId && (
              <Link href={item.href} className={`btn ${action ? "btn-ghost" : "btn-primary"} no-underline`}>
                {action ? "Abrir ficha" : "Abrir e resolver"}
              </Link>
            )}
            {!action && !item.patientId && (
              <Link href={item.href} className="btn btn-primary no-underline">
                Abrir e resolver
              </Link>
            )}
          </div>
        )}

        {draft && <DraftIntakeCard draft={draft} focus />}
      </article>
    );

    const missingLabels = draft
      ? draft.pendencies.pills.filter((p) => p.state === "faltando").map((p) => `falta ${p.label}`)
      : [];

    return {
      id: item.id,
      category: item.category,
      categoryLabel: item.categoryLabel,
      name: item.patientName,
      band: urgencyBand({ category: item.category, overdue, escalated, dueAt: item.dueAt ?? null }, now, CLINIC_TIMEZONE),
      overdue,
      escalated,
      dueAt: item.dueAt ?? null,
      dueText: due,
      ownerId: item.assignedToId ?? null,
      ownerName: item.assignedToName ?? null,
      stage,
      missingCount: draft ? draft.pendencies.missingCount : null,
      mine: Boolean(user && item.assignedToId === user.id),
      haystack: normalizeSearch(
        [
          item.patientName,
          item.detail,
          item.categoryLabel,
          item.urgencyLabel,
          item.assignedToName,
          draft?.patientName,
          draft?.sourcePhone,
          ...(draft?.facts.map((f) => f.value) ?? []),
          ...missingLabels,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      readDraftId:
        draft && (draft.status === "pending" || draft.status === "failed") && draft.files.length > 0 ? draft.id : null,
      detail,
    };
  });

  const etapa = QUEUE_STAGES.includes(params.etapa as QueueStage) ? (params.etapa as QueueStage) : null;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Fila de pendências"
        description="Tudo o que a recepção precisa resolver, do mais urgente ao que pode esperar."
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
