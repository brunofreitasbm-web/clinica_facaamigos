// tests/intake-actions-static.test.ts
//
// Checagens de código-fonte das ações da Fila de entrada (o repositório não tem banco nos testes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("app/recepcao/pacientes/pendencias/intake-actions.ts", "utf8");

test("só ações sem WhatsApp têm desfazer", () => {
  assert.doesNotMatch(src, /enableDraftScheduling|registerAuthorizedGuide|disableDraftScheduling/);
  for (const name of ["intakeMarkGuideSent", "intakeUnmarkGuideSent", "intakeWaiveAuthorization", "intakeDenyPlan", "intakePlanAskedMoreDocs", "restoreIntakeState"]) {
    assert.match(src, new RegExp(`export async function ${name}\\(`));
  }
  assert.doesNotMatch(src, /export async function (denyPlan|undoDenyPlan|planAskedMoreDocs|undoPlanAskedMoreDocs)\(/);
});

test("sem a migration, withUndo executa a ação e devolve sem desfazer", () => {
  const fn = /async function withUndo[\s\S]*?\n}\n/.exec(src)?.[0] ?? "";
  assert.match(fn, /before === MISSING_COLUMNS\)[\s\S]*?await action\(\)[\s\S]*?undo: null/);
});

test("revalida a Fila, não a tela antiga", () => {
  assert.match(src, /revalidatePath\("\/recepcao\/fila"\)/);
  assert.doesNotMatch(src, /a-autorizar/);
});
