// lib/intake-queue-build-pure.ts
// Monta `draft.intake` (etapa, grupo e desde quando o caso espera) a partir de um rascunho já carregado.
// PURO, sem import com alias `@/`.

import { intakeGroup, intakeStage, type IntakeGroup, type IntakeInput, type IntakeStage } from "./intake-queue-pure.ts";
import { missingChaseKeys, type LeadPendencies } from "./lead-pendencies.ts";

export type DraftIntake = {
  stage: IntakeStage;
  group: IntakeGroup;
  /** ISO: desde quando o caso espera no passo atual (base da ordenação da fila). */
  waitingSince: string;
};

export type IntakeDraftLike = {
  createdAt: string;
  pipeline: {
    authorization: IntakeInput["authorization"];
    guideSentAt: string | null;
    authorizedAt: string | null;
    schedulingEnabledAt: string | null;
    returned: { at: string } | null;
  };
  pendencies: LeadPendencies;
  documentRequests: { sentAt: string }[];
};

/** Última cobrança de documento enviada à família, ou null. */
export function latestFamilyChase(requests: { sentAt: string }[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const r of requests) {
    const ms = Date.parse(r.sentAt);
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = r.sentAt;
    }
  }
  return best;
}

export function toIntakeInput(d: IntakeDraftLike): IntakeInput {
  return {
    authorization: d.pipeline.authorization,
    schedulingEnabledAt: d.pipeline.schedulingEnabledAt,
    // Só documentos (pílulas com chaseKey); dados faltando não entram.
    missingDocs: missingChaseKeys(d.pendencies).length,
    familyChasedAt: latestFamilyChase(d.documentRequests),
    // Colunas ainda não existem (Task 5 adiciona); por ora sempre null.
    planDeniedAt: null,
    planAskedMoreDocsAt: null,
  };
}

export function waitingSinceOf(d: IntakeDraftLike): string {
  const p = d.pipeline;
  if (p.authorization === "enviada" && p.guideSentAt) return p.guideSentAt;
  if (p.authorization === "autorizada" && p.authorizedAt) return p.authorizedAt;
  if (p.returned && !p.guideSentAt) return p.returned.at;
  return d.createdAt;
}

export function buildIntake(d: IntakeDraftLike, now: Date): DraftIntake {
  const input = toIntakeInput(d);
  return { stage: intakeStage(input), group: intakeGroup(input, now), waitingSince: waitingSinceOf(d) };
}
