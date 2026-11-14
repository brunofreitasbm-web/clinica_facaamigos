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

test("se salvar a guia falhar, o formulário reabre com os valores digitados", () => {
  assert.match(step, /initialValues=\{pendingGuide \?\? undefined\}/);
  assert.match(step, /setGuideOpen\(true\)/);
  assert.match(step, /Voltar e corrigir/);
  const dialog = readFileSync("app/recepcao/pacientes/pendencias/draft-pipeline.tsx", "utf8");
  assert.match(dialog, /initialValues\?: GuideValues/);
  assert.match(dialog, /initialValues \?\? defaultGuideValues\(suggestedGuide\)/);
});

test("a confirmação é um grupo rotulado e recebe o foco", () => {
  assert.match(step, /role=\{confirm \? "group" : undefined\}/);
  assert.match(step, /aria-label=\{confirm \? CONFIRM_GROUP_LABEL\[confirm\]/);
  assert.match(step, /ref=\{confirmButtonRef\}/);
  assert.match(step, /confirmButtonRef\.current\?\.focus\(\)/);
});

test("robô do portal na Fila: interativo só no passo da guia e com plano, só leitura aguardando o plano", () => {
  assert.match(step, /detail\?\.hasPlan && step\.kind === "send_guide"[\s\S]*?<PortalRobotPanel target=\{\{ kind: "draft", id: item\.draftId \}\} canRequest minimal \/>/);
  assert.match(step, /step\.kind === "wait_plan"[\s\S]*?<PortalRobotPanel target=\{\{ kind: "draft", id: item\.draftId \}\} canRequest=\{false\} minimal \/>/);
});

test("'O plano já autorizou' no passo da guia abre o mesmo formulário com conferência, como link discreto", () => {
  assert.match(step, /step\.kind === "send_guide"[\s\S]*?className=\{linkClass\} onClick=\{\(\) => setGuideOpen\(true\)\}[\s\S]*?O plano já autorizou/);
});

test("pedido de um documento só: mesma ação, conferência antes de enviar", () => {
  const doc = readFileSync("app/recepcao/fila/fila-doc-request.tsx", "utf8");
  const detail = readFileSync("app/recepcao/fila/fila-detail.tsx", "utf8");
  assert.match(doc, /requestMissingDocument\(draftId, chaseKey\)/);
  assert.match(doc, /actionConfirms\("ask_documents"\)/);
  assert.match(doc, /Enviar mensagem/);
  assert.match(detail, /<FilaDocRequest/);
});

test("Ajustar cadastro na Fila: recarrega o detalhe ao salvar e leva os rascunhos mesclados", () => {
  const detail = readFileSync("app/recepcao/fila/fila-detail.tsx", "utf8");
  assert.match(detail, /<DraftAdjustButton[\s\S]*?memberDraftIds=\{item\.memberDraftIds\}[\s\S]*?setReloadKey\(\(k\) => k \+ 1\)/);
});

test("Salvar ajustes confere linhas afetadas e grava bot_collected nos rascunhos da família", () => {
  const actions = readFileSync("app/recepcao/pacientes/pendencias/draft-adjust-actions.ts", "utf8");
  assert.match(actions, /patientRows\.length === 0/);
  assert.match(actions, /applyAdjustmentToBotCollected\(row\.bot_collected/);
  assert.match(actions, /revalidatePath\("\/recepcao\/fila"\)/);
  // arquivo "use server": só funções async podem ser exportadas
  assert.doesNotMatch(actions, /^export function /m);
});
