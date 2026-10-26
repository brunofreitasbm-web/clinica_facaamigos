import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingQueueItem } from "@/lib/reception-queue";
import { fmtDueShort, fmtWaitingDays } from "@/lib/format";
import { RegisterContactButton } from "./register-contact-button";
import { ResolveAutoFaltaButton } from "./resolve-auto-falta-button";
import { ResolveSimpleButton } from "./resolve-simple-button";
import { AuthorizeRenewalButton } from "./authorize-renewal-button";
import { ResolveRenewalRequestButton } from "./resolve-renewal-request-button";
import { ReassignOwnerButton } from "./reassign-owner-button";
import { resolveRescheduleRequest } from "./actions";
import { DraftIntakeCard } from "./draft-intake-card";
import { DraftPipelineMini } from "./draft-pipeline";
import { SummaryChip } from "./pendency-pills";
import type { QueueStage, WorkspaceItem } from "./queue-workspace";
import { normalizeSearch, urgencyBand } from "./queue-filters-pure";

/**
 * Converte a fila da recepção nos itens do <QueueWorkspace> (lista + painel de
 * detalhe). Compartilhado entre a Fila de pendências e a tela "À autorizar".
 */

export function draftStage(item: PendingQueueItem): QueueStage | null {
  if (!item.draft) return null;
  const pipeline = item.draft.pipeline;
  if (item.draft.pendencies.missingCount > 0) return "docs";
  if (pipeline?.schedulingEnabledAt) return "liberado";
  if (pipeline?.authorization === "autorizada" || pipeline?.authorization === "dispensada") return "agendar";
  return "autorizacao";
}

function dueText(item: PendingQueueItem): string {
  if (item.escalatedAt) return fmtWaitingDays(item.escalatedAt, CLINIC_TIMEZONE);
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
  if (category === "renovacao_solicitada" && item.renewalRequestId)
    return (
      <div className="flex flex-wrap items-start justify-end gap-2">
        {item.renewalPending && <AuthorizeRenewalButton patientName={item.patientName} pending={item.renewalPending} />}
        <ResolveRenewalRequestButton requestId={item.renewalRequestId} />
      </div>
    );
  return null;
}

export function buildWorkspaceItems(
  queue: PendingQueueItem[],
  ctx: { reassignCandidates: { id: string; full_name: string }[] | null; userId: string | null },
): WorkspaceItem[] {
  const { reassignCandidates } = ctx;
  const user = ctx.userId ? { id: ctx.userId } : null;
  const now = new Date();
    return queue.map((item) => {
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
            {draft?.mergedDraftsCount && draft.mergedDraftsCount > 1 && (
              <span className="rounded-full bg-paper-line px-2.5 py-1 text-xs font-semibold text-ink-soft">
                {draft.mergedDraftsCount} conversas unificadas
              </span>
            )}
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
}
