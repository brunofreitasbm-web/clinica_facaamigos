import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { getReceptionQueue, type PendingQueueCategory } from "@/lib/reception-queue";
import { RegisterContactButton } from "./register-contact-button";
import { ResolveAutoFaltaButton } from "./resolve-auto-falta-button";
import { ResolveSimpleButton } from "./resolve-simple-button";
import { ResolveRenewalRequestButton } from "./resolve-renewal-request-button";
import { ReassignOwnerButton } from "./reassign-owner-button";
import { resolveRescheduleRequest, reviewFamilyDocument } from "./actions";
import { AutorizacaoWizard } from "./autorizacao-wizard";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: PendingQueueCategory[] = [
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
        description="§9.1 do PRD: guia vencendo, guia com poucas sessões, cadastro incompleto, evolução pendente > 24h, documento vencido, interessado sem retorno, falta automática sem motivo, pedido de remarcação, documento da família e renovação de guia já solicitada — tudo numa fila só, por urgência, com dono e prazo."
      />
      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <AutorizacaoWizard />
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
                {items.map((item) => {
                  const isEscalated = Boolean(item.escalatedAt);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
                        isEscalated
                          ? "border-status-negative-text bg-status-negative-text/5"
                          : "border-paper-line-strong bg-paper/60"
                      }`}
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
                          <span className="tabular-figure whitespace-nowrap text-status-negative-text">
                            {item.urgencyLabel}
                          </span>
                        )}
                        {/* Dono + prazo (§9.1) — attachQueueAssignments em lib/reception-queue.ts
                            garante que todo item chega aqui com assignment (ou null durante uma
                            corrida rara entre duas cargas concorrentes da fila). */}
                        <p className="whitespace-nowrap text-[11px] text-ink-faint">
                          {item.assignedToName ?? "Sem dono"}
                          {item.dueAt && (
                            <>
                              {" · "}
                              {isEscalated ? (
                                <span className="font-semibold text-status-negative-text">
                                  escalado{" "}
                                  {new Date(item.escalatedAt as string).toLocaleString("pt-BR", {
                                    timeZone: CLINIC_TIMEZONE,
                                  })}
                                </span>
                              ) : item.overdue ? (
                                <span className="font-semibold text-status-negative-text">
                                  atrasado desde{" "}
                                  {new Date(item.dueAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                                </span>
                              ) : (
                                <>
                                  prazo{" "}
                                  {new Date(item.dueAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
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
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
