// lib/intake-queue-pure.ts
// Fila de entrada: etapa (1 a 4) e grupo de cada caso, a partir de campos já carregados.
//
//   1 Documentos → 2 Enviar guia → 3 Aguardar plano → 4 Habilitado
//
// PURO, sem import com alias `@/`.
//
// Precedência: habilitado > plano negou > plano pediu mais documentos > estado de `authorization`.

export type IntakeStage = 1 | 2 | 3 | 4;
export type IntakeGroup = "agir_agora" | "aguardando_familia" | "aguardando_plano" | "concluidos";

export type IntakeInput = {
  authorization: "pendente" | "enviada" | "autorizada" | "dispensada";
  schedulingEnabledAt: string | null;
  missingDocs: number;
  familyChasedAt: string | null;
  planDeniedAt: string | null;
  planAskedMoreDocsAt: string | null;
};

/** Cobrança à família enviada há este número de dias (ou mais) sem resposta volta para "agir agora". */
export const FAMILY_WAIT_DAYS = 3;

export const INTAKE_GROUP_ORDER: IntakeGroup[] = ["agir_agora", "aguardando_familia", "aguardando_plano", "concluidos"];

const DAY_MS = 24 * 60 * 60 * 1000;

function time(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Cobrança existe e ainda é mais nova que FAMILY_WAIT_DAYS. */
function chaseIsFresh(familyChasedAt: string | null, now: Date): boolean {
  const chased = time(familyChasedAt);
  if (chased === null) return false;
  return now.getTime() - chased < FAMILY_WAIT_DAYS * DAY_MS;
}

export function intakeStage(i: IntakeInput): IntakeStage {
  if (i.schedulingEnabledAt) return 4;
  if (i.planDeniedAt) return 2;
  if (i.planAskedMoreDocsAt) return 1;
  switch (i.authorization) {
    case "pendente":
      return 2;
    default:
      return 3;
  }
}

export function intakeGroup(i: IntakeInput, now: Date): IntakeGroup {
  if (i.schedulingEnabledAt) return "concluidos";
  if (i.planDeniedAt) return "agir_agora";
  if (i.planAskedMoreDocsAt) {
    const asked = time(i.planAskedMoreDocsAt);
    const chased = time(i.familyChasedAt);
    const answeredByChase = asked !== null && chased !== null && chased >= asked;
    return answeredByChase && chaseIsFresh(i.familyChasedAt, now) ? "aguardando_familia" : "agir_agora";
  }
  switch (i.authorization) {
    case "pendente":
      return i.missingDocs > 0 && chaseIsFresh(i.familyChasedAt, now) ? "aguardando_familia" : "agir_agora";
    case "enviada":
      return "aguardando_plano";
    default:
      return "agir_agora";
  }
}

export function intakeStageLabel(i: IntakeInput): string {
  const stage = intakeStage(i);
  switch (stage) {
    case 1:
      return "1 de 4 · Documentos";
    case 2:
      return "2 de 4 · Enviar guia";
    case 3:
      return i.authorization === "enviada" ? "3 de 4 · Aguardar plano" : "3 de 4 · Subir guia";
    case 4:
      return "4 de 4 · Habilitado";
  }
}
