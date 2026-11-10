"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getSingleRegistrationDraft, type DraftAuthorizedGuide } from "@/lib/reception-queue";
import type { LeadPill } from "@/lib/lead-pendencies";

/** O que o detalhe da Fila precisa de um contato. Carregado sob demanda, ao selecionar na lista. */
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
  };
  createdAt: string;
  mergedDraftsCount: number | null;
};

/**
 * Detalhe de um contato da Fila, sob demanda. SOMENTE LEITURA.
 *
 * Antes a tela de Autorizações montava o detalhe de TODOS os itens no servidor e mandava tudo ao navegador;
 * aqui a lista leva só o resumo e o detalhe vem quando o operador seleciona a família.
 */
export async function getFilaDetail(
  draftId: string,
): Promise<{ success: true; detail: FilaDetail } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const draft = await getSingleRegistrationDraft(supabase, draftId, DEV_CLINIC_ID);
  if (!draft) return { success: false, error: "Contato não encontrado." };

  return {
    success: true,
    detail: {
      draftId: draft.id,
      patientName: draft.patientName,
      status: draft.status,
      error: draft.error,
      warnings: draft.warnings,
      pills: draft.pendencies.pills,
      facts: draft.facts,
      files: draft.files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, detectedType: f.detectedType })),
      documentRequests: draft.documentRequests.map((r) => ({ key: r.key, sentAt: r.sentAt })),
      pipeline: {
        authorization: draft.pipeline.authorization,
        guideSentAt: draft.pipeline.guideSentAt,
        guideSentByName: draft.pipeline.guideSentByName,
        authorizedAt: draft.pipeline.authorizedAt,
        authorizedByName: draft.pipeline.authorizedByName,
        schedulingEnabledAt: draft.pipeline.schedulingEnabledAt,
        returned: draft.pipeline.returned,
        suggestedGuide: draft.pipeline.suggestedGuide,
      },
      createdAt: draft.createdAt,
      mergedDraftsCount: draft.mergedDraftsCount ?? null,
    },
  };
}
