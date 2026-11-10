// tests/fila-ui-static.test.ts
//
// Checagens estáticas da tela da Fila: Desfazer pelo restaurador, "Plano autorizou" só depois da
// conferência, botões travados enquanto envia e respostas do plano em "Aguardando plano".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const step = readFileSync("app/recepcao/fila/fila-next-step.tsx", "utf8");
const ws = readFileSync("app/recepcao/fila/fila-workspace.tsx", "utf8");

test("desfazer da Fila é o restaurador, nunca as ações antigas de desfazer", () => {
  assert.doesNotMatch(step, /\bundoGuideSent\b|\bundoDraftAuthorization\b|UNDO_MS/);
  assert.match(step, /restoreIntakeState\(item\.draftId/);
  assert.match(ws, /useUndoToast\(UNDO_SECONDS/);
  assert.match(ws, /<UndoToast /);
});

test("plano autorizou só grava depois da confirmação", () => {
  const dialog = /<AuthorizedGuideDialog[\s\S]*?\/>/.exec(step)?.[0] ?? "";
  assert.doesNotMatch(dialog, /registerAuthorizedGuide|enableDraftScheduling/);
  assert.match(step, /Salvar e enviar horários/);
});

test("botões de confirmação travam enquanto envia", () => {
  assert.match(step, /disabled=\{isPending \|\| locked\}/);
});

test("plano negou e pediu mais documentos aparecem em Aguardando plano", () => {
  assert.match(step, /intakeDenyPlan\(item\.draftId\)/);
  assert.match(step, /intakePlanAskedMoreDocs\(item\.draftId\)/);
});

test("pedido de mais documentos do plano envia de verdade ou leva ao Chat", () => {
  assert.match(step, /item\.moreDocsKeys/);
  assert.match(step, /chatHref\(\{ phone/);
});

test("a tela lê a política das ações em vez de repetir a regra", () => {
  assert.match(step, /fila-action-policy-pure/);
});
