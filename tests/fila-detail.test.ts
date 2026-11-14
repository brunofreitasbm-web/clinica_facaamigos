// tests/fila-detail.test.ts
//
// Detalhe da Fila sob demanda: vem do MESMO caso consolidado da lista (só os rascunhos mesclados nele), a
// rota checa a sessão antes do id e nunca deixa a resposta em cache, e o cliente ignora respostas velhas e
// trava as ações enquanto rebusca.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { draftReadFilters, pickConsolidatedDraft } from "../lib/intake-detail-pick-pure.ts";
import { isPathAllowedForRole } from "../lib/roles.ts";
import {
  FILA_DETAIL_PATH,
  MAX_MEMBER_IDS,
  classifyDetailResponse,
  filaDetailUrl,
  detailLoadReducer,
  isDetailLocked,
  parseMemberIds,
  toFilaDetail,
  type FilaDetail,
} from "../lib/fila/fila-detail-pure.ts";

const PIPELINE: FilaDetail["pipeline"] = {
  authorization: "enviada",
  guideSentAt: "2026-11-01T10:00:00Z",
  guideSentByName: "Ana",
  authorizedAt: null,
  authorizedByName: null,
  schedulingEnabledAt: null,
  returned: null,
  suggestedGuide: null,
  planDeniedAt: "2026-11-05T10:00:00Z",
  planAskedMoreDocsAt: null,
};

const D1: FilaDetail = {
  draftId: "d1",
  patientName: "Nina",
  status: "extracted",
  error: null,
  warnings: [],
  pills: [],
  facts: [],
  files: [],
  documentRequests: [],
  pipeline: PIPELINE,
  createdAt: "2026-10-30T10:00:00Z",
  mergedDraftsCount: null,
};
const D2: FilaDetail = { ...D1, draftId: "d2", patientName: "Theo" };

// Sem anotação: o rascunho real tem campos a mais (authorizedGuide, missingCount...) que o detalhe não leva.
const SOURCE = {
  id: "d1",
  patientName: "Nina",
  status: "extracted",
  error: null,
  warnings: ["Conferir CPF"],
  pendencies: { pills: [], missingCount: 0, summary: "" },
  facts: [{ label: "Criança", value: "Nina" }],
  files: [{ id: "f1", name: "laudo.pdf", mimeType: "application/pdf", detectedType: "laudo_medico" }],
  documentRequests: [{ key: "carteirinha", sentAt: "2026-11-02T10:00:00Z" }],
  pipeline: { ...PIPELINE, authorizedGuide: null, authorizationId: null, registered: false },
  createdAt: "2026-10-30T10:00:00Z",
  mergedDraftsCount: 2 as number | undefined,
};

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

test("parseMemberIds: sem ids usa o próprio caso; recusa id inválido, lista longa ou sem o caso", () => {
  const A = "11111111-1111-4111-8111-111111111111",
    B = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(parseMemberIds(null, A), [A]);
  assert.deepEqual(parseMemberIds(`${A},${B}`, A), [A, B]);
  assert.equal(parseMemberIds(`${B}`, A), null);
  assert.equal(parseMemberIds(`${A},nope`, A), null);
  assert.equal(parseMemberIds(Array(21).fill(A).join(","), A), null);
  assert.equal(parseMemberIds("", A), null);
  assert.deepEqual(parseMemberIds(`${A},${A},${B},${B}`, A), [A, B]);
  assert.equal(MAX_MEMBER_IDS, 20);
});

test("resposta antiga não sobrescreve a busca mais nova; a rebusca mantém o detalhe e trava as ações", () => {
  let s = detailLoadReducer({ status: "loading", requestId: 1 }, { type: "start", requestId: 2 });
  s = detailLoadReducer(s, { type: "success", requestId: 1, detail: D1 });
  assert.equal(s.status, "loading");
  s = detailLoadReducer(s, { type: "success", requestId: 2, detail: D2 });
  assert.deepEqual(s, { status: "ready", detail: D2 });
  s = detailLoadReducer(s, { type: "start", requestId: 3 });
  assert.equal(s.status, "refreshing");
  assert.equal(isDetailLocked(s), true);
  s = detailLoadReducer(s, { type: "fail", requestId: 3, kind: "auth", message: "Sua sessão expirou. Entre de novo." });
  assert.equal(s.status === "error" && s.kind, "auth");
});

test("erro guarda o detalhe anterior, continua travado, e uma nova busca limpa o erro", () => {
  let s = detailLoadReducer({ status: "ready", detail: D1 }, { type: "start", requestId: 5 });
  s = detailLoadReducer(s, { type: "fail", requestId: 4, kind: "other", message: "velho" });
  assert.equal(s.status, "refreshing");
  s = detailLoadReducer(s, { type: "fail", requestId: 5, kind: "other", message: "Falhou." });
  assert.deepEqual(s, { status: "error", requestId: 5, kind: "other", message: "Falhou.", detail: D1 });
  assert.equal(isDetailLocked(s), true);
  s = detailLoadReducer(s, { type: "start", requestId: 6 });
  assert.deepEqual(s, { status: "refreshing", requestId: 6, detail: D1 });
  // Sucesso com o id de uma busca que não está pendente (estado pronto) é ignorado.
  const ready = detailLoadReducer(s, { type: "success", requestId: 6, detail: D2 });
  assert.equal(isDetailLocked(ready), false);
  assert.deepEqual(detailLoadReducer(ready, { type: "success", requestId: 6, detail: D1 }), ready);
  // Sem detalhe anterior, a busca começa do zero.
  const fresh = detailLoadReducer({ status: "error", requestId: 1, kind: "other", message: "x", detail: null }, { type: "start", requestId: 2 });
  assert.deepEqual(fresh, { status: "loading", requestId: 2 });
});

test("toFilaDetail leva as marcas do plano e não leva campos pesados além do que o detalhe usa", () => {
  const d = toFilaDetail(SOURCE);
  assert.equal(d.pipeline.planDeniedAt, SOURCE.pipeline.planDeniedAt);
  assert.deepEqual(Object.keys(d).sort(), [
    "createdAt",
    "documentRequests",
    "draftId",
    "error",
    "facts",
    "files",
    "hasPlan",
    "mergedDraftsCount",
    "patientName",
    "pills",
    "pipeline",
    "status",
    "warnings",
  ]);
  assert.equal("authorizedGuide" in d.pipeline, false);
  assert.equal(d.mergedDraftsCount, 2);
  assert.equal(toFilaDetail({ ...SOURCE, mergedDraftsCount: undefined }).mergedDraftsCount, null);
});

test("toFilaDetail: hasPlan vem das pendências e é falso quando a informação não veio (robô só com plano)", () => {
  assert.equal(toFilaDetail({ ...SOURCE, pendencies: { ...SOURCE.pendencies, hasPlan: true } }).hasPlan, true);
  assert.equal(toFilaDetail({ ...SOURCE, pendencies: { pills: SOURCE.pendencies.pills } }).hasPlan, false);
});

test("rota: sessão antes do id, 401 JSON sem cache, consolidado sem persistir, nunca o avulso como primeira fonte", () => {
  const route = readFileSync("app/recepcao/fila/detalhe/[draftId]/route.ts", "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(route.indexOf("getUser()") < route.indexOf("isUuid(draftId)"));
  assert.match(route, /\{ error: "unauthenticated" \}, \{ status: 401, headers: NO_STORE \}/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /getConsolidatedRegistrationDraft\(/);
  assert.doesNotMatch(route, /getSingleRegistrationDraft/);
  const lib = readFileSync("lib/reception-queue.ts", "utf8");
  const fn = /export async function getConsolidatedRegistrationDraft[\s\S]*?\n}\n/.exec(lib)?.[0] ?? "";
  assert.match(fn, /persistMerge: false/);
  assert.match(fn, /onlyIds: memberIds/);
  assert.match(fn, /pickConsolidatedDraft\(consolidated, draftId\) \?\? \(await getSingleRegistrationDraft/);
});

test("a tela não usa mais a server action de detalhe", () => {
  assert.equal(existsSync("app/recepcao/fila/fila-detail-action.ts"), false);
  assert.equal(existsSync("app/api/recepcao/fila-de-entrada"), false);
  assert.equal(existsSync("app/api/recepcao/fila"), false);
  const panel = readFileSync("app/recepcao/fila/fila-detail.tsx", "utf8");
  assert.match(panel, /filaDetailUrl\(item\.draftId, item\.memberDraftIds\)/);
  assert.match(panel, /redirect: "manual"/);
  assert.match(panel, /classifyDetailResponse\(/);
  assert.match(panel, /new AbortController\(\)/);
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /Sua sessão expirou\. Entre de novo\./);
  assert.match(panel, /Tentar de novo/);
  assert.match(panel, /Atualizando…/);
  assert.match(panel, /locked=\{isDetailLocked\(load\)\}/);
  const step = readFileSync("app/recepcao/fila/fila-next-step.tsx", "utf8");
  assert.doesNotMatch(step, /const locked = false/);
  assert.match(step, /locked: boolean/);
});

test("a rota do detalhe mora sob /recepcao: o guard de papel deixa recepção, supervisão e gestor passarem", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const url = filaDetailUrl(A, [A]);
  assert.equal(url, `${FILA_DETAIL_PATH}/${A}?ids=${A}`);
  assert.ok(existsSync("app/recepcao/fila/detalhe/[draftId]/route.ts"));
  const path = url.split("?")[0];
  for (const role of ["recepcao", "supervisor", "gestor"] as const) assert.equal(isPathAllowedForRole(role, path), true, role);
  // O caminho antigo (/api/...) era redirecionado para a home da recepção e o fetch recebia HTML.
  assert.equal(isPathAllowedForRole("recepcao", `/api/recepcao/fila/${A}`), false);
  assert.equal(isPathAllowedForRole("supervisor", `/api/recepcao/fila/${A}`), false);
  assert.equal(isPathAllowedForRole("terapeuta", path), false);
  assert.equal(isPathAllowedForRole(undefined, path), true);
});

test("isPathAllowedForRole: mesma regra do middleware (home + prefixos; gestor isento)", () => {
  assert.equal(isPathAllowedForRole("faturamento", "/recepcao/pacientes/1"), true);
  assert.equal(isPathAllowedForRole("faturamento", "/recepcao/fila"), false);
  assert.equal(isPathAllowedForRole("recepcao", "/m/atendimento"), true);
  assert.equal(isPathAllowedForRole("responsavel", "/familia/x"), true);
  assert.equal(isPathAllowedForRole("gestor", "/qualquer"), true);
  const mw = readFileSync("lib/supabase/middleware.ts", "utf8");
  assert.match(mw, /isPathAllowedForRole\(role, pathname\)/);
});

test("classifyDetailResponse: redirecionamento ou HTML é sessão expirada; 404 é caso sumido", () => {
  const json = "application/json; charset=utf-8";
  assert.equal(classifyDetailResponse({ status: 200, type: "basic", redirected: false, contentType: json }), "ok");
  assert.equal(classifyDetailResponse({ status: 0, type: "opaqueredirect", redirected: false, contentType: null }), "auth");
  assert.equal(classifyDetailResponse({ status: 401, type: "basic", redirected: false, contentType: json }), "auth");
  assert.equal(classifyDetailResponse({ status: 200, type: "basic", redirected: true, contentType: "text/html" }), "auth");
  assert.equal(classifyDetailResponse({ status: 200, type: "basic", redirected: false, contentType: "text/html; charset=utf-8" }), "auth");
  assert.equal(classifyDetailResponse({ status: 404, type: "basic", redirected: false, contentType: json }), "notfound");
  assert.equal(classifyDetailResponse({ status: 400, type: "basic", redirected: false, contentType: json }), "error");
  assert.equal(classifyDetailResponse({ status: 500, type: "basic", redirected: false, contentType: "text/html" }), "error");
});

test("leitura por ids não filtra rejeitados nem só ativos (a lista já decidiu quem é do caso)", () => {
  assert.deepEqual(draftReadFilters(), { ids: null, activeOnly: true });
  assert.deepEqual(draftReadFilters(["a", "b"]), { ids: ["a", "b"], activeOnly: false });
  const lib = readFileSync("lib/reception-queue.ts", "utf8");
  const fn = /async function getPendingRegistrationDrafts[\s\S]*?\n}\n/.exec(lib)?.[0] ?? "";
  assert.equal((fn.match(/applyDraftReadFilters\(/g) ?? []).length, 2, "as duas leituras (completa e legada) usam o filtro");
  assert.doesNotMatch(fn, /\.neq\("status", "rejected"\)/, "o filtro de ativos mora em applyDraftReadFilters");
  assert.doesNotMatch(fn, /\.in\("id"/);
});
