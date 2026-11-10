// Projeção "leve" de um caso da Fila de entrada para a lista (nome, etapa, telefone, responsável, datas).
// PURO, sem import com alias `@/` (roda em node:test).
//
// O rascunho completo (arquivos, dados lidos, mensagens, cobranças, avisos e o detalhe de pendências)
// NÃO vai para a lista: chega sob demanda quando um caso é aberto (/api/recepcao/fila-de-entrada/[draftId]).

import type { IntakeGroup } from "../../../lib/intake-queue-pure.ts";

/** Campos do rascunho que a lista usa. Tudo o mais fica de fora de propósito. */
type DraftForList = {
  id: string;
  createdAt: string;
  sourcePhone: string | null;
  mergedDraftsCount?: number;
  pipeline: { authorization: string };
  intake: { group: IntakeGroup; waitingSince: string; label: string };
};

/** Campos do item de trabalho (buildWorkspaceItems) que a lista usa. */
type WorkspaceItemForList = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  mine: boolean;
  haystack: string;
  readDraftId: string | null;
  stage: string | null;
};

export type IntakeQueueListItem = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  mine: boolean;
  /** Texto de busca já normalizado (nome, telefone, dados lidos, "falta <doc>"). */
  haystack: string;
  /** Rascunho com arquivos ainda não lidos: a IA lê ao abrir o caso. */
  readDraftId: string | null;
  /** Id do rascunho, usado para buscar o detalhe sob demanda. */
  draftId: string | null;
  phone: string | null;
  createdAt: string;
  group: IntakeGroup;
  waitingSince: string;
  /** Ex.: "2 de 4 · Enviar guia". */
  stageLabel: string;
  isCompleted: boolean;
  /** Conversas unificadas no caso; o detalhe sob demanda não recalcula isso. */
  mergedDraftsCount: number | null;
};

export function toIntakeListItem(
  item: WorkspaceItemForList,
  draft: DraftForList | null | undefined,
  nowIso: string,
): IntakeQueueListItem {
  const authStatus = draft?.pipeline.authorization ?? "pendente";
  const isCompleted =
    authStatus === "autorizada" || authStatus === "dispensada" || item.stage === "agendar" || item.stage === "liberado";
  return {
    id: item.id,
    name: item.name,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    mine: item.mine,
    haystack: item.haystack,
    readDraftId: item.readDraftId,
    draftId: draft?.id ?? null,
    phone: draft?.sourcePhone ?? null,
    createdAt: draft?.createdAt ?? nowIso,
    // Todo caso da fila tem rascunho; o fallback só evita quebrar a tela.
    group: draft?.intake.group ?? "agir_agora",
    waitingSince: draft?.intake.waitingSince ?? nowIso,
    stageLabel: draft?.intake.label ?? "",
    isCompleted,
    mergedDraftsCount: draft?.mergedDraftsCount && draft.mergedDraftsCount > 1 ? draft.mergedDraftsCount : null,
  };
}
