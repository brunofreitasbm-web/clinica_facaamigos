// lib/draft-pipeline-steps-pure.ts
// Trilha do contato na fila de Autorizações, do recebimento dos arquivos até o agendamento:
//
//   ① Documentos recebidos → ② Guia enviada ao plano → ③ Plano autorizou → ④ Habilitado p/ agendamento
//
// Extraído de app/recepcao/pacientes/pendencias/draft-pipeline.tsx (sem mudar o comportamento) para
// a tela de Chat mostrar a MESMA etapa sem duplicar a regra. PURO, sem import com alias `@/`.

export type PipelineStepState = "done" | "current" | "locked";

export const PIPELINE_STEP_TITLES = [
  "Documentos recebidos",
  "Guia enviada ao plano",
  "Plano autorizou",
  "Habilitado p/ agendamento",
] as const;

type PipelineLike = {
  /** "enviada" = a clínica já mandou a guia ao plano, ainda sem resposta. */
  authorization: "pendente" | "enviada" | "autorizada" | "dispensada";
  schedulingEnabledAt: string | null;
};

export function pipelineStepStates(
  pipeline: PipelineLike,
): [PipelineStepState, PipelineStepState, PipelineStepState, PipelineStepState] {
  const waived = pipeline.authorization === "dispensada";
  const sentDone = waived || pipeline.authorization !== "pendente";
  const authDone = waived || pipeline.authorization === "autorizada";
  const enabled = Boolean(pipeline.schedulingEnabledAt);
  return [
    "done",
    sentDone ? "done" : "current",
    authDone ? "done" : sentDone ? "current" : "locked",
    enabled ? "done" : authDone ? "current" : "locked",
  ];
}

/** Um chip só com a etapa da vez; `index` é 0-based (−1 quando tudo está concluído). */
export function pipelineStageLabel(pipeline: PipelineLike): { label: string; index: number; allDone: boolean } {
  const states = pipelineStepStates(pipeline);
  const index = states.findIndex((state) => state === "current");
  if (index === -1) return { label: `✓ ${PIPELINE_STEP_TITLES[3]}`, index: -1, allDone: true };
  return { label: `Etapa ${index + 1}/4 · ${PIPELINE_STEP_TITLES[index]}`, index, allDone: false };
}
