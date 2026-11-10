import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickConsolidatedDraft } from "../lib/intake-detail-pick-pure.ts";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("pickConsolidatedDraft escolhe o caso consolidado pelo id, sem inventar", () => {
  const consolidated = [
    { id: "a", mergedDraftsCount: 2, intake: { stage: "enviar_guia" } },
    { id: "b", intake: { stage: "aguardar_plano" } },
  ];
  assert.equal(pickConsolidatedDraft(consolidated, "a")?.intake.stage, "enviar_guia");
  assert.equal(pickConsolidatedDraft(consolidated, "b")?.id, "b");
  assert.equal(pickConsolidatedDraft(consolidated, "zzz"), null);
  assert.equal(pickConsolidatedDraft([], "a"), null);
});

test("o detalhe usa a consolidação da fila (mesma da lista) e só cai no avulso se o caso saiu da fila", () => {
  const lib = read("lib/reception-queue.ts");
  const fn = /export async function getConsolidatedRegistrationDraft[\s\S]*?\n}\n/.exec(lib)?.[0] ?? "";
  assert.match(fn, /getPendingRegistrationDrafts\(supabase, clinicId\)/);
  assert.match(fn, /pickConsolidatedDraft\(consolidated, draftId\)/);
  // O avulso só vale como fallback (depois do ??), nunca como primeira fonte.
  assert.match(fn, /pickConsolidatedDraft\(consolidated, draftId\) \?\? \(await getSingleRegistrationDraft/);
  const route = read("app/api/recepcao/fila-de-entrada/[draftId]/route.ts");
  assert.match(route, /getConsolidatedRegistrationDraft\(/);
  assert.doesNotMatch(route.replace(/\/\/.*$/gm, ""), /getSingleRegistrationDraft/);
});

test("a rota checa a sessão antes do id e responde 401 JSON sem cache", () => {
  const route = read("app/api/recepcao/fila-de-entrada/[draftId]/route.ts").replace(/\/\/.*$/gm, "");
  assert.ok(route.indexOf("getUser()") < route.indexOf("isUuid(draftId)"), "sessão deve vir antes do isUuid");
  assert.match(route, /\{ error: "unauthenticated" \}, \{ status: 401, headers: NO_STORE \}/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});

test("o cliente trava as ações durante a rebusca, mostra erro com retry e trata 401", () => {
  const ws = read("app/recepcao/a-autorizar/authorizations-workspace.tsx");
  assert.match(ws, /<fieldset disabled=\{detailLocked\}/);
  assert.match(ws, /detailLocked = detailRefreshing \|\| Boolean\(detailFailure\)/);
  assert.match(ws, /Tentar de novo/);
  assert.match(ws, /Atualizando…/);
  assert.match(ws, /Sua sessão expirou\. Entre de novo\./);
  assert.match(ws, /res\.status === 401/);
  // O erro antigo é limpo quando uma nova busca começa.
  assert.match(ws, /setDetailError\(null\);\s*setFetchingId\(selectedKey\);/);
});
