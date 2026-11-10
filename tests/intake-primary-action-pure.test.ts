import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_ROBOT_VIEW, nextRobotState, primaryAction } from "../app/recepcao/a-autorizar/intake-primary-action-pure.ts";
import type { IntakeInput } from "../lib/intake-queue-pure.ts";

const base: IntakeInput = {
  authorization: "pendente",
  schedulingEnabledAt: null,
  missingDocs: 0,
  familyChasedAt: null,
  planDeniedAt: null,
  planAskedMoreDocsAt: null,
};

test("etapa 1 (plano pediu mais documentos): sem botão principal", () => {
  const i = { ...base, planAskedMoreDocsAt: "2026-11-09T12:00:00Z" };
  assert.deepEqual(primaryAction(i, true), { kind: "none", label: "" });
  assert.deepEqual(primaryAction(i, false), { kind: "none", label: "" });
});

test("etapa 2 com robô ligado: envia pelo robô", () => {
  assert.deepEqual(primaryAction(base, true), { kind: "send_via_robot", label: "Enviar guia ao plano" });
});

test("etapa 2 com robô desligado: marcar guia como enviada", () => {
  assert.deepEqual(primaryAction(base, false), { kind: "mark_sent", label: "Marcar guia como enviada" });
});

test("etapa 2 com documento faltando continua com o botão principal (nada bloqueia)", () => {
  assert.equal(primaryAction({ ...base, missingDocs: 3 }, false).kind, "mark_sent");
  assert.equal(primaryAction({ ...base, missingDocs: 3 }, true).kind, "send_via_robot");
});

test("etapa 2 por plano negou segue a mesma regra do robô", () => {
  const i = { ...base, authorization: "enviada" as const, planDeniedAt: "2026-11-09T12:00:00Z" };
  assert.equal(primaryAction(i, true).kind, "send_via_robot");
  assert.equal(primaryAction(i, false).kind, "mark_sent");
});

test("etapa 3: subir guia autorizada, com ou sem robô", () => {
  const i = { ...base, authorization: "enviada" as const };
  const expected = { kind: "upload_authorized_pdf", label: "Subir guia autorizada (PDF)" };
  assert.deepEqual(primaryAction(i, true), expected);
  assert.deepEqual(primaryAction(i, false), expected);
});

test("etapa 4: caso concluído, sem botão principal", () => {
  const i = { ...base, authorization: "autorizada" as const, schedulingEnabledAt: "2026-11-09T12:00:00Z" };
  assert.deepEqual(primaryAction(i, true), { kind: "none", label: "" });
  assert.deepEqual(primaryAction(i, false), { kind: "none", label: "" });
});

test("nextRobotState: consulta com robô ligado", () => {
  assert.deepEqual(nextRobotState({ agentOnline: true, jobOpen: false }), { loaded: true, online: true, jobOpen: false });
});

test("nextRobotState: consulta com robô desligado e pedido aberto", () => {
  assert.deepEqual(nextRobotState({ agentOnline: false, jobOpen: true }), { loaded: true, online: false, jobOpen: true });
});

test("nextRobotState: falha depois de ligado volta para desligado", () => {
  const before = nextRobotState({ agentOnline: true, jobOpen: true });
  assert.equal(before.online, true);
  const after = nextRobotState("error");
  assert.deepEqual(after, { loaded: true, online: false, jobOpen: false });
  assert.equal(primaryAction(base, after.online).kind, "mark_sent");
});

test("nextRobotState: exceção conta como carregado e desligado", () => {
  assert.deepEqual(INITIAL_ROBOT_VIEW, { loaded: false, online: false, jobOpen: false });
  const after = nextRobotState("error");
  assert.equal(after.loaded, true);
  assert.equal(after.online, false);
});
