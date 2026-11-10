// tests/intake-queue-pure.test.ts
//
// Fila de entrada: etapa (1 a 4) e grupo de cada caso.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAMILY_WAIT_DAYS,
  INTAKE_GROUP_ORDER,
  intakeGroup,
  intakeStage,
  intakeStageLabel,
  type IntakeInput,
} from "../lib/intake-queue-pure.ts";

const NOW = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const base: IntakeInput = {
  authorization: "pendente",
  schedulingEnabledAt: null,
  missingDocs: 0,
  familyChasedAt: null,
  planDeniedAt: null,
  planAskedMoreDocsAt: null,
};
const make = (over: Partial<IntakeInput> = {}): IntakeInput => ({ ...base, ...over });
const result = (i: IntakeInput) => [intakeStage(i), intakeGroup(i, NOW)];

test("espera da família é de 3 dias", () => {
  assert.equal(FAMILY_WAIT_DAYS, 3);
});

test("pendente, nada faltando: etapa 2, agir agora", () => {
  assert.deepEqual(result(make()), [2, "agir_agora"]);
});

test("pendente com documentos faltando: sem cobrança, agir agora", () => {
  assert.deepEqual(result(make({ missingDocs: 6 })), [2, "agir_agora"]);
});

test("pendente com documentos faltando: cobrança há 1 dia aguarda a família", () => {
  assert.deepEqual(result(make({ missingDocs: 6, familyChasedAt: daysAgo(1) })), [2, "aguardando_familia"]);
});

test("pendente com documentos faltando: cobrança há 3 dias volta para agir agora", () => {
  assert.deepEqual(result(make({ missingDocs: 6, familyChasedAt: daysAgo(3) })), [2, "agir_agora"]);
});

test("pendente sem faltar nada, com cobrança recente: agir agora", () => {
  assert.deepEqual(result(make({ missingDocs: 0, familyChasedAt: daysAgo(1) })), [2, "agir_agora"]);
});

test("guia enviada: etapa 3, aguardando plano", () => {
  assert.deepEqual(result(make({ authorization: "enviada" })), [3, "aguardando_plano"]);
});

test("autorizada sem habilitar: etapa 3, agir agora", () => {
  assert.deepEqual(result(make({ authorization: "autorizada" })), [3, "agir_agora"]);
});

test("autorizada e habilitada: etapa 4, concluídos", () => {
  assert.deepEqual(
    result(make({ authorization: "autorizada", schedulingEnabledAt: daysAgo(0) })),
    [4, "concluidos"],
  );
});

test("plano negou: etapa 2, agir agora, mesmo com cobrança recente", () => {
  const i = make({ authorization: "enviada", planDeniedAt: daysAgo(1), familyChasedAt: daysAgo(0), missingDocs: 2 });
  assert.deepEqual(result(i), [2, "agir_agora"]);
});

test("plano pediu mais documentos: cobrança depois do pedido aguarda a família", () => {
  const i = make({ authorization: "enviada", planAskedMoreDocsAt: daysAgo(2), familyChasedAt: daysAgo(1) });
  assert.deepEqual(result(i), [1, "aguardando_familia"]);
});

test("plano pediu mais documentos: cobrança igual ao pedido aguarda a família", () => {
  const at = daysAgo(1);
  const i = make({ authorization: "enviada", planAskedMoreDocsAt: at, familyChasedAt: at });
  assert.deepEqual(result(i), [1, "aguardando_familia"]);
});

test("plano pediu mais documentos: sem cobrança ou cobrança anterior ao pedido, agir agora", () => {
  assert.deepEqual(result(make({ authorization: "enviada", planAskedMoreDocsAt: daysAgo(1) })), [1, "agir_agora"]);
  assert.deepEqual(
    result(make({ authorization: "enviada", planAskedMoreDocsAt: daysAgo(1), familyChasedAt: daysAgo(2) })),
    [1, "agir_agora"],
  );
});

test("plano pediu mais documentos: cobrança de 3 dias ou mais sem resposta volta para agir agora", () => {
  const i = make({ authorization: "enviada", planAskedMoreDocsAt: daysAgo(5), familyChasedAt: daysAgo(3) });
  assert.deepEqual(result(i), [1, "agir_agora"]);
});

test("dispensada sem habilitar: etapa 3, agir agora", () => {
  assert.deepEqual(result(make({ authorization: "dispensada" })), [3, "agir_agora"]);
});

test("habilitado vence plano negou e pedido de documentos", () => {
  const i = make({
    authorization: "autorizada",
    schedulingEnabledAt: daysAgo(0),
    planDeniedAt: daysAgo(1),
    planAskedMoreDocsAt: daysAgo(1),
  });
  assert.deepEqual(result(i), [4, "concluidos"]);
});

test("plano negou vence pedido de documentos", () => {
  const i = make({ planDeniedAt: daysAgo(1), planAskedMoreDocsAt: daysAgo(1), familyChasedAt: daysAgo(0) });
  assert.deepEqual(result(i), [2, "agir_agora"]);
});

test("rótulos da etapa", () => {
  assert.equal(intakeStageLabel(make()), "2 de 4 · Enviar guia");
  assert.equal(intakeStageLabel(make({ authorization: "enviada" })), "3 de 4 · Aguardar plano");
  assert.equal(intakeStageLabel(make({ authorization: "autorizada" })), "3 de 4 · Subir guia");
  assert.equal(intakeStageLabel(make({ authorization: "dispensada" })), "3 de 4 · Subir guia");
  assert.equal(
    intakeStageLabel(make({ authorization: "autorizada", schedulingEnabledAt: daysAgo(0) })),
    "4 de 4 · Habilitado",
  );
  assert.equal(intakeStageLabel(make({ planAskedMoreDocsAt: daysAgo(1) })), "1 de 4 · Documentos");
});

test("propriedade: toda combinação cai em um grupo válido e etapa de 1 a 4", () => {
  const auths: IntakeInput["authorization"][] = ["pendente", "enviada", "autorizada", "dispensada"];
  const enabled = [null, daysAgo(0)];
  const missing = [0, 3];
  const chased = [null, daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(10)];
  const denied = [null, daysAgo(1)];
  const asked = [null, daysAgo(2)];
  let count = 0;
  for (const authorization of auths)
    for (const schedulingEnabledAt of enabled)
      for (const missingDocs of missing)
        for (const familyChasedAt of chased)
          for (const planDeniedAt of denied)
            for (const planAskedMoreDocsAt of asked) {
              const i: IntakeInput = {
                authorization,
                schedulingEnabledAt,
                missingDocs,
                familyChasedAt,
                planDeniedAt,
                planAskedMoreDocsAt,
              };
              const group = intakeGroup(i, NOW);
              const stage = intakeStage(i);
              assert.ok(INTAKE_GROUP_ORDER.includes(group), JSON.stringify(i));
              assert.ok([1, 2, 3, 4].includes(stage), JSON.stringify(i));
              assert.equal(stage === 4, group === "concluidos", JSON.stringify(i));
              assert.ok(intakeStageLabel(i).startsWith(`${stage} de 4`), JSON.stringify(i));
              count++;
            }
  assert.equal(count, 4 * 2 * 2 * 5 * 2 * 2);
});
