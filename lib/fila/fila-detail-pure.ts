// lib/fila/fila-detail-pure.ts
// Detalhe de uma família da Fila de entrada, carregado sob demanda pela rota GET /api/recepcao/fila/[draftId].
// PURO, sem I/O e sem imports com alias `@/` (testado em tests/fila-detail.test.ts).
//
// O detalhe sai do MESMO caso consolidado da lista: o item da lista leva os ids dos rascunhos mesclados nele
// e a rota consolida só esses. Aqui ficam o formato que viaja ao navegador, a validação dos ids e o estado
// da busca no cliente (resposta velha não sobrescreve a nova; ações travadas enquanto rebusca ou falhou).

import type { LeadPill } from "../lead-pendencies.ts";
import type { DraftAuthorizedGuide } from "../draft-merge.ts";

/** O que o detalhe da Fila precisa de um contato (mais leve que o rascunho inteiro: sem mensagens). */
export type FilaDetail = {
  draftId: string;
  /** `patients.full_name` do vínculo; é o nome que o servidor usa nas mensagens (null: "da criança"). */
  patientName: string | null;
  status: string;
  error: string | null;
  warnings: string[];
  pills: LeadPill[];
  facts: { label: string; value: string }[];
  files: { id: string; name: string; mimeType: string; detectedType: string | null }[];
  documentRequests: { key: string; sentAt: string }[];
  pipeline: {
    authorization: "pendente" | "enviada" | "autorizada" | "dispensada";
    guideSentAt: string | null;
    guideSentByName: string | null;
    authorizedAt: string | null;
    authorizedByName: string | null;
    schedulingEnabledAt: string | null;
    returned: { at: string; reason: string; byName: string | null } | null;
    suggestedGuide: DraftAuthorizedGuide | null;
    planDeniedAt: string | null;
    planAskedMoreDocsAt: string | null;
  };
  createdAt: string;
  mergedDraftsCount: number | null;
};

/** Parte do rascunho consolidado (PendingRegistrationDraft) que o detalhe lê. */
export type FilaDetailSource = {
  id: string;
  patientName: string | null;
  status: string;
  error: string | null;
  warnings: string[];
  pendencies: { pills: LeadPill[] };
  facts: { label: string; value: string }[];
  files: { id: string; name: string; mimeType: string; detectedType: string | null }[];
  documentRequests: { key: string; sentAt: string }[];
  pipeline: FilaDetail["pipeline"];
  createdAt: string;
  mergedDraftsCount?: number;
};

export function toFilaDetail(draft: FilaDetailSource): FilaDetail {
  const p = draft.pipeline;
  return {
    draftId: draft.id,
    patientName: draft.patientName,
    status: draft.status,
    error: draft.error,
    warnings: draft.warnings,
    pills: draft.pendencies.pills,
    facts: draft.facts.map((f) => ({ label: f.label, value: f.value })),
    files: draft.files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, detectedType: f.detectedType })),
    documentRequests: draft.documentRequests.map((r) => ({ key: r.key, sentAt: r.sentAt })),
    pipeline: {
      authorization: p.authorization,
      guideSentAt: p.guideSentAt,
      guideSentByName: p.guideSentByName,
      authorizedAt: p.authorizedAt,
      authorizedByName: p.authorizedByName,
      schedulingEnabledAt: p.schedulingEnabledAt,
      returned: p.returned,
      suggestedGuide: p.suggestedGuide,
      planDeniedAt: p.planDeniedAt,
      planAskedMoreDocsAt: p.planAskedMoreDocsAt,
    },
    createdAt: draft.createdAt,
    mergedDraftsCount: draft.mergedDraftsCount ?? null,
  };
}

/** Teto de rascunhos mesclados num caso que a rota aceita (evita consultas enormes por URL forjada). */
export const MAX_MEMBER_IDS = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?ids=` da rota: os rascunhos mesclados no caso. Sem o parâmetro, só o próprio caso. Devolve null (pedido
 * inválido) se algum id não for UUID, se a lista for vazia ou passar do teto, ou se não incluir o próprio caso.
 */
export function parseMemberIds(raw: string | null, draftId: string): string[] | null {
  if (raw === null) return [draftId];
  const ids = raw.split(",");
  if (ids.length < 1 || ids.length > MAX_MEMBER_IDS) return null;
  if (!ids.every((id) => UUID_RE.test(id))) return null;
  if (!ids.includes(draftId)) return null;
  return ids;
}

export type DetailLoad =
  | { status: "loading"; requestId: number }
  | { status: "refreshing"; requestId: number; detail: FilaDetail }
  | { status: "ready"; detail: FilaDetail }
  | { status: "error"; requestId: number; kind: "auth" | "other"; message: string; detail: FilaDetail | null };

export type DetailLoadEvent =
  | { type: "start"; requestId: number }
  | { type: "success"; requestId: number; detail: FilaDetail }
  | { type: "fail"; requestId: number; kind: "auth" | "other"; message: string };

function currentDetail(state: DetailLoad): FilaDetail | null {
  return state.status === "loading" ? null : state.detail;
}

/** Busca pendente: só o `loading` e o `refreshing` esperam resposta. */
function pendingRequestId(state: DetailLoad): number | null {
  return state.status === "loading" || state.status === "refreshing" ? state.requestId : null;
}

export function detailLoadReducer(state: DetailLoad, event: DetailLoadEvent): DetailLoad {
  if (event.type === "start") {
    // Nova busca limpa o erro; o detalhe que já estava na tela continua visível (travado) até a resposta.
    const detail = currentDetail(state);
    return detail ? { status: "refreshing", requestId: event.requestId, detail } : { status: "loading", requestId: event.requestId };
  }
  if (event.requestId !== pendingRequestId(state)) return state;
  if (event.type === "success") return { status: "ready", detail: event.detail };
  return { status: "error", requestId: event.requestId, kind: event.kind, message: event.message, detail: currentDetail(state) };
}

/** As ações só valem com o detalhe atualizado: travadas enquanto carrega, rebusca ou depois de falhar. */
export function isDetailLocked(state: DetailLoad): boolean {
  return state.status !== "ready";
}
