// lib/intake-queue-build-pure.ts
// Monta `draft.intake` (etapa, grupo e desde quando o caso espera) a partir de um rascunho já carregado.
// PURO, sem import com alias `@/`.

import { intakeGroup, intakeStage, intakeStageLabel, type IntakeGroup, type IntakeInput, type IntakeStage } from "./intake-queue-pure.ts";
import { missingChaseKeys, type LeadPendencies } from "./lead-pendencies.ts";

export type DraftIntake = {
  stage: IntakeStage;
  /** Texto da etapa para a linha da fila, ex.: "2 de 4 · Enviar guia". */
  label: string;
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
    /** Quando a recepção registrou "Plano negou" (bruto, sem checar se já foi resolvido). */
    planDeniedAt: string | null;
    /** Quando a recepção registrou "Plano pediu mais documentos" (bruto). */
    planAskedMoreDocsAt: string | null;
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

function ms(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

export type PlanOutcomeFields = {
  authorization: IntakeInput["authorization"];
  guideSentAt: string | null;
  planDeniedAt: string | null;
  planAskedMoreDocsAt: string | null;
};

/**
 * Negativa e pedido de mais documentos que ainda valem. Uma marca deixa de valer quando:
 *   - o plano autorizou (ou o caso foi dispensado como particular), ou
 *   - a guia foi enviada de novo depois dela (guideSentAt mais novo que a marca).
 * Com as duas valendo, fica só a mais recente: é a última resposta do plano.
 */
export function activePlanOutcome(p: PlanOutcomeFields): { planDeniedAt: string | null; planAskedMoreDocsAt: string | null } {
  if (p.authorization === "autorizada" || p.authorization === "dispensada") {
    return { planDeniedAt: null, planAskedMoreDocsAt: null };
  }
  const sent = ms(p.guideSentAt);
  const stillOpen = (at: string | null) => {
    const t = ms(at);
    if (t === null) return false;
    return sent === null || sent <= t;
  };
  let denied = stillOpen(p.planDeniedAt) ? p.planDeniedAt : null;
  let asked = stillOpen(p.planAskedMoreDocsAt) ? p.planAskedMoreDocsAt : null;
  if (denied && asked) {
    if ((ms(denied) ?? 0) >= (ms(asked) ?? 0)) asked = null;
    else denied = null;
  }
  return { planDeniedAt: denied, planAskedMoreDocsAt: asked };
}

export function toIntakeInput(d: IntakeDraftLike): IntakeInput {
  const outcome = activePlanOutcome(d.pipeline);
  return {
    authorization: d.pipeline.authorization,
    schedulingEnabledAt: d.pipeline.schedulingEnabledAt,
    // Só documentos (pílulas com chaseKey); dados faltando não entram.
    missingDocs: missingChaseKeys(d.pendencies).length,
    familyChasedAt: latestFamilyChase(d.documentRequests),
    planDeniedAt: outcome.planDeniedAt,
    planAskedMoreDocsAt: outcome.planAskedMoreDocsAt,
  };
}

export function waitingSinceOf(d: IntakeDraftLike): string {
  const p = d.pipeline;
  const outcome = activePlanOutcome(p);
  if (outcome.planDeniedAt) return outcome.planDeniedAt;
  if (outcome.planAskedMoreDocsAt) return outcome.planAskedMoreDocsAt;
  if (p.authorization === "enviada" && p.guideSentAt) return p.guideSentAt;
  if (p.authorization === "autorizada" && p.authorizedAt) return p.authorizedAt;
  if (p.returned && !p.guideSentAt) return p.returned.at;
  return d.createdAt;
}

export function buildIntake(d: IntakeDraftLike, now: Date): DraftIntake {
  const input = toIntakeInput(d);
  return { stage: intakeStage(input), label: intakeStageLabel(input), group: intakeGroup(input, now), waitingSince: waitingSinceOf(d) };
}
