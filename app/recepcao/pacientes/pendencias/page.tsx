import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { getReceptionQueue, getAuthorizationWizardItems, type PendingQueueCategory } from "@/lib/reception-queue";
import { fmtDueShort } from "@/lib/format";
import { RegisterContactButton } from "./register-contact-button";
import { ResolveAutoFaltaButton } from "./resolve-auto-falta-button";
import { ResolveSimpleButton } from "./resolve-simple-button";
import { ResolveRenewalRequestButton } from "./resolve-renewal-request-button";
import { ReassignOwnerButton } from "./reassign-owner-button";
import { resolveRescheduleRequest, reviewFamilyDocument } from "./actions";
import { AutorizacaoWizard } from "./autorizacao-wizard";
import { DraftIntakeCard } from "./draft-intake-card";
import { CollapsibleQueueRow } from "./collapsible-queue-row";
import { DraftPipelineMini } from "./draft-pipeline";
import { PendencyPills, SummaryChip } from "./pendency-pills";
import { extractDraftOnDemand } from "./draft-pipeline-actions";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

/**
 * Ordem de exibição das categorias. Toda categoria de PendingQueueCategory
 * precisa estar aqui: getReceptionQueue conta o que falta no badge do menu,
 * mas esta página só desenha o que consta nesta lista — uma categoria
 * esquecida aqui vira item invisível (foi o que aconteceu com
 * cadastro_assistido_ia e chegada_nao_confirmada até 20/09/2026).
 */
const CATEGORY_ORDER: PendingQueueCategory[] = [
  // Tem gente esperando no balcão agora (prazo de 15min em
  // DUE_MINUTES_BY_CATEGORY) — nada na fila passa na frente disso.
  "chegada_nao_confirmada",
  // Segundo de propósito: é o que chega pelo WhatsApp fora do expediente e é
  // o ponto de partida de quem abre a clínica (20/09/2026, quando a aba
  // "Cadastro IA" foi retirada da navegação da recepção).
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

export default async function PendenciasPage() {
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
        description="Ponto de partida do expediente: contatos que mandaram documentos pelo WhatsApp ou pelo portal, cada um numa linha do tempo (documentos recebidos → autorização junto ao plano → habilitado para agendamento) com os arquivos, os dados já recebidos e a conversa aqui mesmo, guia vencendo, guia com poucas sessões, cadastro incompleto, evolução pendente > 24h, documento vencido, interessado sem retorno, falta automática sem motivo, pedido de remarcação, documento da família e renovação de guia já solicitada — tudo numa fila só, por urgência, com dono e prazo."
      />
      <PageContainer className="gap-8">
        <AutorizacaoWizard initialItems={authorizations} />
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
              <div className="flex flex-col gap-1.5">
                {items.map((item) => {
                  const isEscalated = Boolean(item.escalatedAt);
                  // Barra de severidade na borda esquerda; sempre acompanhada de chip/texto
                  // (nunca só cor). Só cadastro-IA tem "falta N", então o resto só marca atraso.
                  const severityBar =
                    isEscalated || item.overdue
                      ? "border-l-[3px] border-l-status-negative-text"
                      : item.draft
                        ? item.draft.pendencies.missingCount > 0
                          ? "border-l-[3px] border-l-status-pending-text"
                          : "border-l-[3px] border-l-status-positive-text"
                        : "";
                  const aside = (
                        <div className="flex flex-col items-end gap-1">
                          {category === "interessado_sem_retorno" && item.patientId ? (
                            <RegisterContactButton patientId={item.patientId} />
                          ) : category === "falta_sem_motivo" && item.appointmentId ? (
                            <ResolveAutoFaltaButton appointmentId={item.appointmentId} />
                          ) : category === "remarcacao_solicitada" && item.rescheduleRequestId ? (
                            <ResolveSimpleButton
                              id={item.rescheduleRequestId}
                              label="Marcar como concluído"
                              doneLabel="Concluído"
                              action={resolveRescheduleRequest}
                            />
                          ) : category === "documento_familia_novo" && item.documentId ? (
                            <ResolveSimpleButton
                              id={item.documentId}
                              label="Marcar como revisado"
                              doneLabel="Revisado"
                              action={reviewFamilyDocument}
                            />
                          ) : category === "renovacao_solicitada" && item.renewalRequestId ? (
                            <ResolveRenewalRequestButton requestId={item.renewalRequestId} />
                          ) : (
                            <span
                              className={`tabular-figure whitespace-nowrap ${
                                isEscalated || item.overdue ? "text-status-negative-text" : "text-ink-soft"
                              }`}
                            >
                              {item.urgencyLabel}
                            </span>
                          )}
                          {/* Dono + prazo (§9.1) — attachQueueAssignments em lib/reception-queue.ts
                              garante que todo item chega aqui com assignment (ou null durante uma
                              corrida rara entre duas cargas concorrentes da fila). */}
                          <p className="whitespace-nowrap text-[11px] text-ink-faint">
                            <span title={item.assignedToName ?? undefined}>
                              {item.assignedToName ? item.assignedToName.split(" ")[0] : "Sem dono"}
                            </span>
                            {item.dueAt && (
                              <>
                                {" · "}
                                {isEscalated ? (
                                  <span className="font-semibold text-status-negative-text">
                                    escalado{" "}
                                    {fmtDueShort(item.escalatedAt as string, CLINIC_TIMEZONE)}
                                  </span>
                                ) : item.overdue ? (
                                  <span className="font-semibold text-status-negative-text">
                                    atrasado desde{" "}
                                    {fmtDueShort(item.dueAt, CLINIC_TIMEZONE)}
                                  </span>
                                ) : (
                                  <>
                                    prazo{" "}
                                    {fmtDueShort(item.dueAt, CLINIC_TIMEZONE)}
                                  </>
                                )}
                              </>
                            )}
                          </p>
                          {reassignCandidates && reassignCandidates.length > 0 && (
                            <ReassignOwnerButton
                              itemId={item.id}
                              currentAssigneeId={item.assignedToId ?? null}
                              candidates={reassignCandidates}
                            />
                          )}
                        </div>
                  );
                  return (
                    <div
                      key={item.id}
                      className={`group rounded-md border px-4 py-2.5 text-sm ${
                        isEscalated
                          ? "border-status-negative-text bg-status-negative-text/5"
                          : "border-paper-line-strong bg-paper/60"
                      } ${severityBar}`}
                    >
                      {item.draft ? (
                        // Cadastro assistido por IA: a linha resume e é o gatilho;
                        // o cartão entrega arquivos, dados e conversa sem sair da fila.
                        <CollapsibleQueueRow
                          title={item.patientName}
                          subtitle={
                            <>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                <SummaryChip pendencies={item.draft.pendencies} />
                                <DraftPipelineMini pipeline={item.draft.pipeline} />
                                <span className="whitespace-nowrap rounded-full bg-paper-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                                  Pré-cadastro
                                </span>
                              </span>
                              <span className="mt-1 block text-[12px]">{item.detail}</span>
                              <PendencyPills pendencies={item.draft.pendencies} />
                            </>
                          }
                          aside={aside}
                          // Lê os arquivos com IA só quando alguém abre o contato (nunca ao carregar a fila).
                          onFirstOpen={
                            (item.draft.status === "pending" || item.draft.status === "failed") && item.draft.files.length > 0
                              ? extractDraftOnDemand.bind(null, item.draft.id)
                              : undefined
                          }
                        >
                          <DraftIntakeCard draft={item.draft} />
                        </CollapsibleQueueRow>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
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
                          {aside}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </PageContainer>
    </main>
  );
}
