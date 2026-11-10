// tests/intake-queue-build-pure.test.ts
//
// buildIntake: monta etapa, grupo e "esperando desde" a partir do rascunho carregado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIntake, latestFamilyChase, toIntakeInput, type IntakeDraftLike } from "../lib/intake-queue-build-pure.ts";
import { INTAKE_GROUP_ORDER } from "../lib/intake-queue-pure.ts";
import type { LeadPendencies, LeadPill } from "../lib/lead-pendencies.ts";

const NOW = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
const CREATED = "2026-11-01T09:00:00.000Z";

const pill = (state: LeadPill["state"], chaseKey?: LeadPill["chaseKey"]) =>
  ({ key: `k-${state}-${chaseKey ?? "x"}`, label: "x", group: chaseKey ? "documento" : "dado", state, chaseKey }) as unknown as LeadPill;

const pendencies = (pills: LeadPill[] = []): LeadPendencies => ({
  pills,
  hasPlan: true,
  missingCount: pills.filter((p) => p.state === "faltando").length,
  summary: "",
});

const draft = (over: Partial<IntakeDraftLike> & { pipeline?: Partial<IntakeDraftLike["pipeline"]> } = {}): IntakeDraftLike => ({
  createdAt: CREATED,
  pendencies: pendencies(),
  documentRequests: [],
  ...over,
  pipeline: {
    authorization: "pendente",
    guideSentAt: null,
    authorizedAt: null,
    schedulingEnabledAt: null,
    returned: null,
    ...over.pipeline,
  },
});

test("waitingSince: guia enviada usa guideSentAt", () => {
  const d = draft({ pipeline: { authorization: "enviada", guideSentAt: "2026-11-05T10:00:00Z" } });
  assert.equal(buildIntake(d, NOW).waitingSince, "2026-11-05T10:00:00Z");
});

test("waitingSince: autorizada usa authorizedAt", () => {
  const d = draft({ pipeline: { authorization: "autorizada", guideSentAt: "2026-11-05T10:00:00Z", authorizedAt: "2026-11-08T10:00:00Z" } });
  assert.equal(buildIntake(d, NOW).waitingSince, "2026-11-08T10:00:00Z");
});

test("waitingSince: devolvido e guia não enviada usa o momento da devolução", () => {
  const d = draft({ pipeline: { returned: { at: "2026-11-07T10:00:00Z" } } });
  assert.equal(buildIntake(d, NOW).waitingSince, "2026-11-07T10:00:00Z");
});

test("waitingSince: demais casos usam createdAt", () => {
  assert.equal(buildIntake(draft(), NOW).waitingSince, CREATED);
  // devolvido mas com guia já enviada: o relógio é o da guia
  const d = draft({ pipeline: { authorization: "enviada", guideSentAt: "2026-11-06T10:00:00Z", returned: { at: "2026-11-07T10:00:00Z" } } });
  assert.equal(buildIntake(d, NOW).waitingSince, "2026-11-06T10:00:00Z");
});

test("familyChasedAt é a cobrança mais recente; sem cobrança é null", () => {
  assert.equal(latestFamilyChase([]), null);
  assert.equal(
    latestFamilyChase([{ sentAt: "2026-11-02T10:00:00Z" }, { sentAt: "2026-11-09T10:00:00Z" }, { sentAt: "2026-11-05T10:00:00Z" }]),
    "2026-11-09T10:00:00Z",
  );
});

test("missingDocs conta só documentos faltando (dados e outros estados ficam de fora)", () => {
  const d = draft({
    pendencies: pendencies([
      pill("faltando", "laudo_medico"),
      pill("faltando", "carteirinha"),
      pill("faltando"),
      pill("ok", "pedido_medico"),
      pill("aviso", "documento_responsavel"),
    ]),
  });
  const input = toIntakeInput(d);
  assert.equal(input.missingDocs, 2);
  assert.equal(input.planDeniedAt, null);
  assert.equal(input.planAskedMoreDocsAt, null);
});

test("documentos faltando e cobrança recente: aguardando família; cobrança antiga: agir agora", () => {
  const pills = [pill("faltando", "laudo_medico")];
  const fresh = draft({ pendencies: pendencies(pills), documentRequests: [{ sentAt: daysAgo(1) }] });
  const stale = draft({ pendencies: pendencies(pills), documentRequests: [{ sentAt: daysAgo(5) }] });
  assert.equal(buildIntake(fresh, NOW).group, "aguardando_familia");
  assert.equal(buildIntake(stale, NOW).group, "agir_agora");
});

test("soma dos grupos sobre casos sintéticos dos quatro grupos é igual ao total de casos", () => {
  const docs = [pill("faltando", "laudo_medico")];
  const cases: IntakeDraftLike[] = [
    draft(), // agir agora (guia a enviar)
    draft({ pipeline: { authorization: "autorizada", authorizedAt: daysAgo(1) } }), // agir agora (habilitar)
    draft({ pendencies: pendencies(docs), documentRequests: [{ sentAt: daysAgo(1) }] }), // aguardando família
    draft({ pendencies: pendencies(docs), documentRequests: [{ sentAt: daysAgo(2) }] }), // aguardando família
    draft({ pipeline: { authorization: "enviada", guideSentAt: daysAgo(2) } }), // aguardando plano
    draft({ pipeline: { authorization: "enviada", guideSentAt: daysAgo(9) } }), // aguardando plano
    draft({ pipeline: { authorization: "autorizada", schedulingEnabledAt: daysAgo(1) } }), // concluídos
  ];
  const counts = new Map(INTAKE_GROUP_ORDER.map((g) => [g, 0]));
  for (const c of cases) {
    const g = buildIntake(c, NOW).group;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  for (const g of INTAKE_GROUP_ORDER) assert.ok((counts.get(g) ?? 0) > 0, `grupo ${g} coberto`);
  const sum = [...counts.values()].reduce((a, b) => a + b, 0);
  assert.equal(sum, cases.length);
});

test("label da etapa: pendente, enviada e habilitado", () => {
  assert.equal(buildIntake(draft(), NOW).label, "2 de 4 · Enviar guia");
  assert.equal(buildIntake(draft({ pipeline: { authorization: "enviada" } }), NOW).label, "3 de 4 · Aguardar plano");
  assert.equal(
    buildIntake(draft({ pipeline: { authorization: "autorizada", schedulingEnabledAt: "2026-11-09T10:00:00Z" } }), NOW).label,
    "4 de 4 · Habilitado",
  );
});
