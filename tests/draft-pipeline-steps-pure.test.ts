// tests/draft-pipeline-steps-pure.test.ts
//
// Trilha do contato na fila de Autorizações: documentos → guia enviada → plano autorizou → habilitado.
// Regra extraída de app/recepcao/pacientes/pendencias/draft-pipeline.tsx sem mudar o comportamento.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PIPELINE_STEP_TITLES, pipelineStageLabel, pipelineStepStates } from "../lib/draft-pipeline-steps-pure.ts";

const p = (authorization: "pendente" | "enviada" | "autorizada" | "dispensada", enabled = false) => ({
  authorization,
  schedulingEnabledAt: enabled ? "2026-11-09T12:00:00Z" : null,
});

test("guia ainda não enviada: etapa 2 é a da vez", () => {
  assert.deepEqual(pipelineStepStates(p("pendente")), ["done", "current", "locked", "locked"]);
});

test("guia enviada, plano ainda não respondeu: etapa 3 é a da vez", () => {
  assert.deepEqual(pipelineStepStates(p("enviada")), ["done", "done", "current", "locked"]);
});

test("plano autorizou, falta habilitar o agendamento: etapa 4 é a da vez", () => {
  assert.deepEqual(pipelineStepStates(p("autorizada")), ["done", "done", "done", "current"]);
});

test("autorização dispensada pula as etapas 2 e 3", () => {
  assert.deepEqual(pipelineStepStates(p("dispensada")), ["done", "done", "done", "current"]);
});

test("habilitado para agendamento: tudo concluído", () => {
  assert.deepEqual(pipelineStepStates(p("autorizada", true)), ["done", "done", "done", "done"]);
});

test("rótulo curto da etapa atual (igual ao chip da fila)", () => {
  assert.deepEqual(pipelineStageLabel(p("pendente")), {
    label: "Etapa 2/4 · Guia enviada ao plano",
    index: 1,
    allDone: false,
  });
  assert.deepEqual(pipelineStageLabel(p("enviada")), {
    label: "Etapa 3/4 · Plano autorizou",
    index: 2,
    allDone: false,
  });
});

test("rótulo quando tudo está concluído", () => {
  assert.deepEqual(pipelineStageLabel(p("autorizada", true)), {
    label: "✓ Habilitado p/ agendamento",
    index: -1,
    allDone: true,
  });
});

test("títulos das 4 etapas", () => {
  assert.deepEqual([...PIPELINE_STEP_TITLES], [
    "Documentos recebidos",
    "Guia enviada ao plano",
    "Plano autorizou",
    "Habilitado p/ agendamento",
  ]);
});
