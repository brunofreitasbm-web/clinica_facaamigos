import { test } from "node:test";
import assert from "node:assert/strict";
import { toIntakeListItem } from "../app/recepcao/a-autorizar/intake-list-item-pure.ts";

const NOW = "2026-11-10T12:00:00.000Z";

// Rascunho "pesado" como getReceptionQueue devolve, com tudo que a lista NÃO pode carregar.
const heavyDraft = {
  id: "d-1",
  createdAt: "2026-11-01T10:00:00.000Z",
  sourcePhone: "5511999990000",
  mergedDraftsCount: 3,
  pipeline: { authorization: "enviada", authorizedGuide: { guide_number: "123" } },
  intake: { group: "aguardando_plano" as const, waitingSince: "2026-11-05T10:00:00.000Z", label: "3 de 4 · Aguardar plano" },
  files: [{ id: "f1", name: "carteirinha.jpg", mimeType: "image/jpeg", detectedType: "carteirinha" }],
  facts: [{ label: "CPF da criança", value: "000.000.000-00" }],
  messages: [{ direction: "inbound", body: "oi", sentAt: NOW, hasMedia: false }],
  warnings: ["aviso"],
  error: null,
  guardianMessage: "segue o laudo",
  documentRequests: [{ key: "laudo", sentAt: NOW }],
  pendencies: { missingCount: 2, pills: [{ label: "Laudo", state: "faltando" }] },
};

const workspaceItem = {
  id: "cadastro-ia-d-1",
  name: "Maria",
  ownerId: "u1",
  ownerName: "Ana",
  mine: true,
  haystack: "maria · 5511999990000",
  readDraftId: null,
  stage: "autorizacao",
  // campos extras do WorkspaceItem que a lista não leva
  category: "cadastro_assistido_ia",
  dueText: "hoje",
  band: "hoje",
};

test("projeta só campos leves e mantém os da lista", () => {
  const out = toIntakeListItem(workspaceItem, heavyDraft, NOW);
  assert.deepEqual(out, {
    id: "cadastro-ia-d-1",
    name: "Maria",
    ownerId: "u1",
    ownerName: "Ana",
    mine: true,
    haystack: "maria · 5511999990000",
    readDraftId: null,
    draftId: "d-1",
    phone: "5511999990000",
    createdAt: "2026-11-01T10:00:00.000Z",
    group: "aguardando_plano",
    waitingSince: "2026-11-05T10:00:00.000Z",
    stageLabel: "3 de 4 · Aguardar plano",
    isCompleted: false,
    mergedDraftsCount: 3,
  });
});

test("campos pesados ficam de fora da projeção", () => {
  const out = toIntakeListItem(workspaceItem, heavyDraft, NOW) as Record<string, unknown>;
  for (const heavy of [
    "files",
    "facts",
    "messages",
    "warnings",
    "error",
    "guardianMessage",
    "documentRequests",
    "pendencies",
    "pipeline",
    "draft",
    "detail",
    "category",
    "dueText",
  ]) {
    assert.equal(heavy in out, false, `${heavy} não deveria estar na lista`);
  }
});

test("a projeção é pequena frente ao rascunho completo", () => {
  const out = JSON.stringify(toIntakeListItem(workspaceItem, heavyDraft, NOW));
  const full = JSON.stringify(heavyDraft);
  assert.ok(out.length < full.length, `${out.length} deveria ser menor que ${full.length}`);
});

test("concluído: autorizada, dispensada ou etapa agendar/liberado", () => {
  const done = (authorization: string, stage: string | null) =>
    toIntakeListItem({ ...workspaceItem, stage }, { ...heavyDraft, pipeline: { authorization } }, NOW).isCompleted;
  assert.equal(done("autorizada", null), true);
  assert.equal(done("dispensada", null), true);
  assert.equal(done("pendente", "agendar"), true);
  assert.equal(done("pendente", "liberado"), true);
  assert.equal(done("enviada", "autorizacao"), false);
});

test("sem rascunho cai em Agir agora com a hora do servidor", () => {
  const out = toIntakeListItem(workspaceItem, null, NOW);
  assert.equal(out.group, "agir_agora");
  assert.equal(out.waitingSince, NOW);
  assert.equal(out.draftId, null);
  assert.equal(out.mergedDraftsCount, null);
});

test("mergedDraftsCount 1 não conta como unificado", () => {
  assert.equal(toIntakeListItem(workspaceItem, { ...heavyDraft, mergedDraftsCount: 1 }, NOW).mergedDraftsCount, null);
});
