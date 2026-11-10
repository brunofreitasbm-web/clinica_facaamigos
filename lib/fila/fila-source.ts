// lib/fila/fila-source.ts
// Converte um item da fila de Autorizações (PendingQueueItem) no que o modelo da Fila de entrada
// (lib/fila/fila-model-pure.ts) consome. Sem I/O: só mapeia campos que a fila já carrega.

import type { PendingQueueItem, PendingRegistrationDraft } from "@/lib/reception-queue";
import { missingChaseKeys } from "@/lib/lead-pendencies";
import { findMissingDocumentTemplate } from "@/lib/document-request-templates";
import { buildFilaItem, type FilaItem, type FilaSource } from "./fila-model-pure";

/** "Deixar para depois" empurra o prazo para mais de 7 dias à frente (mesma regra de queue-items.tsx). */
const POSTPONED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type FilaQueueInfo = {
  id: string;
  patientName: string;
  assignedToId: string | null;
  assignedToName: string | null;
  overdue: boolean;
  postponed: boolean;
};

/** Rascunho + dados da fila (ou neutros, no Chat) no que o modelo da Fila consome. */
export function draftToFilaSource(draft: PendingRegistrationDraft, queue: FilaQueueInfo): FilaSource {
  const missingDocs = missingChaseKeys(draft.pendencies).flatMap((key) => {
    const template = findMissingDocumentTemplate(key);
    return template ? [{ key: template.key, label: template.label }] : [];
  });

  return {
    id: queue.id,
    draftId: draft.id,
    memberDraftIds: draft.mergedDraftIds ?? [draft.id],
    patientName: queue.patientName,
    sourcePhone: draft.sourcePhone,
    createdAt: draft.createdAt,
    facts: draft.facts,
    pipeline: {
      authorization: draft.pipeline.authorization,
      schedulingEnabledAt: draft.pipeline.schedulingEnabledAt,
      guideSentAt: draft.pipeline.guideSentAt,
      planDeniedAt: draft.pipeline.planDeniedAt,
      planAskedMoreDocsAt: draft.pipeline.planAskedMoreDocsAt,
      returned: draft.pipeline.returned
        ? { reason: draft.pipeline.returned.reason, byName: draft.pipeline.returned.byName }
        : null,
    },
    missingCount: draft.pendencies.missingCount,
    missingDocs,
    documentRequests: draft.documentRequests.map((r) => ({ key: r.key, sentAt: r.sentAt })),
    assignedToId: queue.assignedToId,
    assignedToName: queue.assignedToName,
    overdue: queue.overdue,
    postponed: queue.postponed,
  };
}

/** `null` quando o item não tem rascunho (não é uma família da fila de entrada). */
export function toFilaSource(item: PendingQueueItem, nowMs: number): FilaSource | null {
  const draft = item.draft;
  if (!draft) return null;
  return draftToFilaSource(draft, {
    id: item.id,
    patientName: item.patientName,
    assignedToId: item.assignedToId ?? null,
    assignedToName: item.assignedToName ?? null,
    // Mesma leitura da tela atual: escalado ou com prazo vencido.
    overdue: Boolean(item.escalatedAt) || Boolean(item.overdue),
    postponed: item.dueAt ? new Date(item.dueAt).getTime() > nowMs + POSTPONED_AFTER_MS : false,
  });
}

export function buildFilaItems(queue: PendingQueueItem[], nowMs: number): FilaItem[] {
  return queue.flatMap((item) => {
    const source = toFilaSource(item, nowMs);
    return source ? [buildFilaItem(source, nowMs)] : [];
  });
}
