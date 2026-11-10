// tests/fila-model-pure.test.ts
//
// Modelo da Fila de entrada (/recepcao/fila): em que grupo cada família está, qual é o próximo passo,
// há quanto tempo espera e como filtrar. Regra pura, sem banco.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activePlanOutcome,
  buildFilaItem,
  buildHistory,
  countByGroup,
  filterFila,
  portalFields,
  sortFila,
  trailStates,
  waitLabel,
  type FilaSource,
} from "../lib/fila/fila-model-pure.ts";

const NOW = Date.parse("2026-11-10T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const LAUDO = { key: "laudo_medico", label: "Laudo médico" };
const CART = { key: "carteirinha", label: "Carteirinha" };

const base: FilaSource = {
  id: "q1",
  draftId: "d1",
  patientName: "Nina Rocha Bastos",
  sourcePhone: "+5591900000106",
  createdAt: ago(3),
  facts: [
    { label: "Responsável", value: "Carla Rocha" },
    { label: "Plano de saúde", value: "IASEP" },
  ],
  pipeline: { authorization: "pendente", schedulingEnabledAt: null, returned: null },
  missingCount: 0,
  missingDocs: [],
  documentRequests: [],
  assignedToId: null,
  assignedToName: null,
  overdue: false,
  postponed: false,
};
const src = (over: Partial<FilaSource> = {}): FilaSource => ({ ...base, ...over });

test("agendamento habilitado: Concluídos, com a Supervisão", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "autorizada", schedulingEnabledAt: ago(1), returned: null } }), NOW);
  assert.equal(i.group, "concluidos");
  assert.equal(i.step.kind, "with_supervision");
  assert.equal(i.step.primaryLabel, null);
  assert.match(i.step.listText, /Supervisão/);
});

test("guia enviada ao plano: Aguardando plano, e o botão é registrar a resposta", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "enviada", schedulingEnabledAt: null, returned: null } }), NOW);
  assert.equal(i.group, "plano");
  assert.equal(i.step.kind, "wait_plan");
  assert.equal(i.step.primaryLabel, "Plano autorizou");
});

test("faltam documentos e nada foi pedido: Agir agora, pedir à família", () => {
  const i = buildFilaItem(src({ missingCount: 2, missingDocs: [LAUDO, CART] }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "ask_documents");
  assert.equal(i.step.listText, "Pedir à família: laudo médico, carteirinha");
  assert.deepEqual(i.askKeys, ["laudo_medico", "carteirinha"]);
});

test("todo documento que falta já foi pedido: Aguardando família", () => {
  const i = buildFilaItem(
    src({
      missingCount: 2,
      missingDocs: [LAUDO, CART],
      documentRequests: [
        { key: "laudo_medico", sentAt: ago(2) },
        { key: "carteirinha", sentAt: ago(2) },
      ],
    })
  , NOW);
  assert.equal(i.group, "familia");
  assert.equal(i.step.kind, "wait_family");
  assert.equal(i.step.listText, "Família precisa enviar: laudo médico, carteirinha");
  assert.equal(i.step.primaryLabel, "Enviar lembrete");
  assert.deepEqual(i.remindKeys, ["laudo_medico", "carteirinha"]);
});

test("parte dos documentos pedida: continua em Agir agora, só pede o que não foi pedido", () => {
  const i = buildFilaItem(
    src({ missingCount: 2, missingDocs: [LAUDO, CART], documentRequests: [{ key: "laudo_medico", sentAt: ago(1) }] })
  , NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "ask_documents");
  assert.deepEqual(i.askKeys, ["carteirinha"]);
});

test("falta só dado (nada que se possa cobrar da família): conferir o cadastro", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [] }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "review_data");
  assert.deepEqual(i.askKeys, []);
});

test("documentos completos e guia não enviada: registrar guia enviada", () => {
  const i = buildFilaItem(src(), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.equal(i.step.primaryLabel, "Registrar guia enviada");
});

test("plano autorizou e falta habilitar: habilitar agendamento", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "autorizada", schedulingEnabledAt: null, returned: null } }), NOW);
  assert.equal(i.step.kind, "enable_scheduling");
  assert.equal(i.step.primaryLabel, "Habilitar agendamento");
});

test("particular (autorização dispensada) também chega a habilitar agendamento", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "dispensada", schedulingEnabledAt: null, returned: null } }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "enable_scheduling");
});

test("documento faltando vence guia enviada (mesma prioridade que a tela atual): a recepção resolve o documento primeiro", () => {
  const i = buildFilaItem(
    src({
      missingCount: 1,
      missingDocs: [LAUDO],
      pipeline: { authorization: "enviada", schedulingEnabledAt: null, returned: null },
    })
  , NOW);
  assert.equal(i.step.kind, "ask_documents");
});

test("habilitado vence tudo: não volta para a fila por um documento detectado depois", () => {
  const i = buildFilaItem(
    src({
      missingCount: 1,
      missingDocs: [LAUDO],
      pipeline: { authorization: "autorizada", schedulingEnabledAt: ago(1), returned: null },
    })
  , NOW);
  assert.equal(i.group, "concluidos");
});

test("devolvido pela Supervisão aparece como aviso e volta para Agir agora", () => {
  const i = buildFilaItem(
    src({ pipeline: { authorization: "autorizada", schedulingEnabledAt: null, returned: { reason: "Guia ilegível", byName: "Carla" } } })
  , NOW);
  assert.equal(i.group, "agir");
  assert.deepEqual(i.returned, { reason: "Guia ilegível", byName: "Carla" });
});

test("responsável e plano vêm dos dados lidos; sem eles, nulo (nunca inventado)", () => {
  const i = buildFilaItem(src(), NOW);
  assert.equal(i.guardian, "Carla Rocha");
  assert.equal(i.plan, "IASEP");
  const semDados = buildFilaItem(src({ facts: [] }), NOW);
  assert.equal(semDados.guardian, null);
  assert.equal(semDados.plan, null);
});

test("tempo de espera: hoje, 1 dia, N dias, e 'atrasado' quando o prazo do sistema venceu", () => {
  assert.equal(waitLabel(ago(0), NOW, false), "hoje");
  assert.equal(waitLabel(ago(1.2), NOW, false), "há 1 dia");
  assert.equal(waitLabel(ago(9), NOW, false), "há 9 dias");
  assert.equal(waitLabel(ago(9), NOW, true), "atrasado, há 9 dias");
  assert.equal(waitLabel("lixo", NOW, false), "");
});

test("ordenação: quem espera há mais tempo primeiro; 'deixar para depois' vai ao fim", () => {
  const a = buildFilaItem(src({ id: "a", createdAt: ago(2) }), NOW);
  const b = buildFilaItem(src({ id: "b", createdAt: ago(9) }), NOW);
  const c = buildFilaItem(src({ id: "c", createdAt: ago(20), postponed: true }), NOW);
  assert.deepEqual(sortFila([a, c, b]).map((x) => x.id), ["b", "a", "c"]);
});

const lista = [
  buildFilaItem(src({ id: "1", patientName: "Nina Rocha Bastos", assignedToId: "eu" }), NOW),
  buildFilaItem(
    src({
      id: "2",
      patientName: "Théo Lacerda Nunes",
      sourcePhone: "+5591900000107",
      facts: [{ label: "Responsável", value: "Bruna Lacerda" }],
      assignedToId: "outra",
      pipeline: { authorization: "enviada", schedulingEnabledAt: null, returned: null },
    })
  , NOW),
  buildFilaItem(
    src({ id: "3", patientName: "Lívia Prado", assignedToId: "eu", missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(1) }] })
  , NOW),
];

test("filtro por aba", () => {
  assert.deepEqual(filterFila(lista, { tab: "agir", mine: false, userId: "eu", query: "" }).map((x) => x.id), ["1"]);
  assert.deepEqual(filterFila(lista, { tab: "plano", mine: false, userId: "eu", query: "" }).map((x) => x.id), ["2"]);
  assert.deepEqual(filterFila(lista, { tab: "familia", mine: false, userId: "eu", query: "" }).map((x) => x.id), ["3"]);
});

test("'Só os meus' usa o responsável da fila, e sem usuário logado não mostra nada", () => {
  assert.deepEqual(filterFila(lista, { tab: "plano", mine: true, userId: "eu", query: "" }).map((x) => x.id), []);
  assert.deepEqual(filterFila(lista, { tab: "agir", mine: true, userId: "eu", query: "" }).map((x) => x.id), ["1"]);
  assert.deepEqual(filterFila(lista, { tab: "agir", mine: true, userId: null, query: "" }).map((x) => x.id), []);
});

test("busca ignora acento e maiúscula, e acha por responsável e por telefone", () => {
  assert.deepEqual(filterFila(lista, { tab: "plano", mine: false, userId: null, query: "theo" }).map((x) => x.id), ["2"]);
  assert.deepEqual(filterFila(lista, { tab: "plano", mine: false, userId: null, query: "BRUNA" }).map((x) => x.id), ["2"]);
  assert.deepEqual(filterFila(lista, { tab: "plano", mine: false, userId: null, query: "(91) 90000-0107" }).map((x) => x.id), ["2"]);
  assert.deepEqual(filterFila(lista, { tab: "plano", mine: false, userId: null, query: "zzz" }).map((x) => x.id), []);
});

test("contagem das abas respeita 'Só os meus' e a busca, não a aba", () => {
  assert.deepEqual(countByGroup(lista, { mine: false, userId: "eu", query: "" }), { agir: 1, familia: 1, plano: 1, concluidos: 0 });
  assert.deepEqual(countByGroup(lista, { mine: true, userId: "eu", query: "" }), { agir: 1, familia: 1, plano: 0, concluidos: 0 });
  assert.deepEqual(countByGroup(lista, { mine: false, userId: "eu", query: "nina" }), { agir: 1, familia: 0, plano: 0, concluidos: 0 });
});

// ---------------------------------------------------------------------------
// Trilha de 4 etapas do detalhe (Documentos, Guia ao plano, Autorização, Agendamento)
// ---------------------------------------------------------------------------
test("trilha: documento faltando é a etapa da vez e trava as seguintes (antes o passo 1 era sempre 'feito')", () => {
  assert.deepEqual(trailStates({ authorization: "pendente", schedulingEnabledAt: null, missingCount: 2 }), [
    "current",
    "locked",
    "locked",
    "locked",
  ]);
});

test("trilha: documentos completos seguem a regra da autorização", () => {
  assert.deepEqual(trailStates({ authorization: "pendente", schedulingEnabledAt: null, missingCount: 0 }), [
    "done",
    "current",
    "locked",
    "locked",
  ]);
  assert.deepEqual(trailStates({ authorization: "enviada", schedulingEnabledAt: null, missingCount: 0 }), [
    "done",
    "done",
    "current",
    "locked",
  ]);
  assert.deepEqual(trailStates({ authorization: "autorizada", schedulingEnabledAt: null, missingCount: 0 }), [
    "done",
    "done",
    "done",
    "current",
  ]);
});

test("trilha: habilitado conclui tudo, mesmo que um documento tenha sido detectado depois", () => {
  assert.deepEqual(trailStates({ authorization: "autorizada", schedulingEnabledAt: ago(1), missingCount: 1 }), [
    "done",
    "done",
    "done",
    "done",
  ]);
});

// ---------------------------------------------------------------------------
// Histórico e dados para copiar
// ---------------------------------------------------------------------------
test("histórico: do mais recente ao mais antigo, só com o que de fato aconteceu", () => {
  const h = buildHistory({
    createdAt: ago(9),
    pipeline: {
      guideSentAt: ago(5),
      guideSentByName: "Maria",
      authorizedAt: ago(1),
      authorizedByName: "Carla",
      schedulingEnabledAt: ago(1),
      returned: null,
    },
    documentRequests: [{ key: "laudo_medico", sentAt: ago(8) }],
  });
  assert.deepEqual(h.map((e) => e.text), [
    "Agendamento habilitado.",
    "Plano autorizou (registrado por Carla).",
    "Guia enviada ao plano por Maria.",
    "Pedido de laudo médico enviado à família.",
    "Contato iniciado pelo WhatsApp.",
  ]);
  assert.ok(Date.parse(h[0].at) >= Date.parse(h[h.length - 1].at));
});

test("histórico: contato novo tem só a primeira linha; devolução da Supervisão aparece com o motivo", () => {
  const novo = buildHistory({
    createdAt: ago(1),
    pipeline: { guideSentAt: null, guideSentByName: null, authorizedAt: null, authorizedByName: null, schedulingEnabledAt: null, returned: null },
    documentRequests: [],
  });
  assert.deepEqual(novo.map((e) => e.text), ["Contato iniciado pelo WhatsApp."]);

  const devolvido = buildHistory({
    createdAt: ago(5),
    pipeline: {
      guideSentAt: null,
      guideSentByName: null,
      authorizedAt: null,
      authorizedByName: null,
      schedulingEnabledAt: null,
      returned: { at: ago(0.5), reason: "Guia ilegível", byName: "Carla" },
    },
    documentRequests: [],
  });
  assert.equal(devolvido[0].text, "Devolvido pela Supervisão (Carla): Guia ilegível");
});

test("dados para o portal: só o que existe, na ordem de preenchimento", () => {
  const fields = portalFields([
    { label: "Plano de saúde", value: "IASEP" },
    { label: "Carteirinha", value: "000 106 221 4" },
    { label: "Responsável", value: "Carla Rocha" },
    { label: "Queixa", value: "fala" },
  ]);
  assert.deepEqual(fields, [
    { label: "Responsável", value: "Carla Rocha" },
    { label: "Plano de saúde", value: "IASEP" },
    { label: "Carteirinha", value: "000 106 221 4" },
  ]);
  assert.deepEqual(portalFields([]), []);
});

// ---------------------------------------------------------------------------
// Resposta do plano: negou / pediu mais documentos
// ---------------------------------------------------------------------------
test("activePlanOutcome: negativa vale até a guia ser reenviada depois dela", () => {
  const b = { authorization: "pendente" as const, guideSentAt: null, planDeniedAt: ago(2), planAskedMoreDocsAt: null };
  assert.deepEqual(activePlanOutcome(b), { planDeniedAt: ago(2), planAskedMoreDocsAt: null });
  assert.equal(activePlanOutcome({ ...b, authorization: "enviada", guideSentAt: ago(1) }).planDeniedAt, null);
  assert.equal(activePlanOutcome({ ...b, authorization: "enviada", guideSentAt: ago(3) }).planDeniedAt, ago(2));
});

test("activePlanOutcome: autorização ou dispensa resolvem as duas marcas", () => {
  const marks = { guideSentAt: null, planDeniedAt: ago(2), planAskedMoreDocsAt: ago(1) };
  assert.deepEqual(activePlanOutcome({ ...marks, authorization: "autorizada" }), { planDeniedAt: null, planAskedMoreDocsAt: null });
  assert.deepEqual(activePlanOutcome({ ...marks, authorization: "dispensada" }), { planDeniedAt: null, planAskedMoreDocsAt: null });
});

test("activePlanOutcome: com as duas valendo, fica só a mais recente", () => {
  const r = activePlanOutcome({ authorization: "pendente", guideSentAt: null, planDeniedAt: ago(3), planAskedMoreDocsAt: ago(1) });
  assert.deepEqual(r, { planDeniedAt: null, planAskedMoreDocsAt: ago(1) });
});

test("activePlanOutcome: empate e datas ilegíveis", () => {
  const at = "2026-11-09T10:00:00.000Z";
  assert.equal(activePlanOutcome({ authorization: "enviada", guideSentAt: at, planDeniedAt: at, planAskedMoreDocsAt: null }).planDeniedAt, at);
  assert.equal(
    activePlanOutcome({ authorization: "enviada", guideSentAt: "2026-11-09T10:00:00+00:00", planDeniedAt: at, planAskedMoreDocsAt: null }).planDeniedAt,
    at,
  );
  assert.deepEqual(activePlanOutcome({ authorization: "pendente", guideSentAt: null, planDeniedAt: at, planAskedMoreDocsAt: at }), {
    planDeniedAt: at,
    planAskedMoreDocsAt: null,
  });
  assert.equal(activePlanOutcome({ authorization: "pendente", guideSentAt: null, planDeniedAt: "lixo", planAskedMoreDocsAt: null }).planDeniedAt, null);
  assert.equal(activePlanOutcome({ authorization: "enviada", guideSentAt: "lixo", planDeniedAt: at, planAskedMoreDocsAt: null }).planDeniedAt, at);
});

const P = (over: Partial<FilaSource["pipeline"]>) => ({ ...base.pipeline, ...over });

test("plano negou: volta para Agir agora no passo de enviar a guia, mesmo com documento faltando", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.equal(i.planOutcome, "denied");
  assert.match(i.step.description, /pode negar de novo/);
  assert.deepEqual(trailStates(i), ["done", "current", "locked", "locked"]);
});

test("negativa resolvida: guia reenviada depois dela volta para Aguardando plano", () => {
  const i = buildFilaItem(src({ pipeline: P({ authorization: "enviada", guideSentAt: ago(0), planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "plano");
  assert.equal(i.planOutcome, null);
});

test("pediu mais documentos sem cobrança: Agir agora, pedir o que falta", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "plan_more_docs");
  assert.deepEqual(i.moreDocsKeys, ["laudo_medico"]);
  assert.equal(i.step.primaryLabel, "Pedir documentos à família");
  assert.deepEqual(trailStates(i), ["current", "locked", "locked", "locked"]);
});

test("pediu mais documentos e nada rastreável falta: botão abre o Chat, nunca uma mensagem vazia", () => {
  const i = buildFilaItem(src({ pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.deepEqual(i.moreDocsKeys, []);
  assert.equal(i.step.primaryLabel, "Abrir conversa no Chat");
});

test("cobrada depois do pedido há menos de 3 dias: Aguardando família; 3 dias ou mais: volta para Agir agora", () => {
  const fresh = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(2) }], pipeline: P({ planAskedMoreDocsAt: ago(2.5) }) }), NOW);
  assert.equal(fresh.group, "familia");
  assert.equal(fresh.step.kind, "wait_family");
  const stale = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(3) }], pipeline: P({ planAskedMoreDocsAt: ago(4) }) }), NOW);
  assert.equal(stale.group, "agir");
  assert.match(stale.step.listText, /sem resposta há 3 dias/);
});

test("cobrança anterior ao pedido do plano não conta como cobrança", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(2) }], pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "plan_more_docs");
});

test("documentos chegaram depois da cobrança: reenviar a guia", () => {
  const i = buildFilaItem(src({ documentRequests: [{ key: "laudo_medico", sentAt: ago(1) }], pipeline: P({ planAskedMoreDocsAt: ago(2) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.match(i.step.listText, /reenviar/);
});

test("habilitado vence negativa e pedido de documentos", () => {
  const i = buildFilaItem(src({ pipeline: P({ authorization: "autorizada", schedulingEnabledAt: ago(0), planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "concluidos");
});

test("histórico mostra negativa e pedido de documentos", () => {
  const h = buildHistory({ createdAt: ago(5), pipeline: { guideSentAt: null, guideSentByName: null, authorizedAt: null, authorizedByName: null, schedulingEnabledAt: null, returned: null, planDeniedAt: ago(2), planAskedMoreDocsAt: ago(1) }, documentRequests: [] });
  assert.deepEqual(h.slice(0, 2).map((e) => e.text), ["Plano pediu mais documentos.", "Plano negou a guia."]);
});

test("soma dos grupos continua igual ao total com casos de negativa e pedido de documentos", () => {
  const items = [P({ planDeniedAt: ago(1) }), P({ planAskedMoreDocsAt: ago(1) }), P({ authorization: "enviada", guideSentAt: ago(1) }), P({ schedulingEnabledAt: ago(1) })].map((p) => buildFilaItem(src({ pipeline: p }), NOW));
  const c = countByGroup(items, { mine: false, userId: null, query: "" });
  assert.equal(c.agir + c.familia + c.plano + c.concluidos, items.length);
});

// ---------------------------------------------------------------------------
// Fronteiras da tabela de decisão da resposta do plano
// ---------------------------------------------------------------------------
test("cobrança no mesmo instante do pedido do plano conta como cobrança (>=)", () => {
  const at = ago(1);
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: at }], pipeline: P({ planAskedMoreDocsAt: at }) }), NOW);
  assert.equal(i.group, "familia");
  assert.equal(i.step.kind, "wait_family");
  assert.equal(i.step.listText, "Plano pediu mais documentos: aguardando a família");
});

test("cobrança com data ilegível é ignorada", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: "lixo" }], pipeline: P({ planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "plan_more_docs");
  assert.equal(i.step.listText, "Plano pediu mais documentos");
});

test("fronteira de 3 dias: 2,99 dias segue em Aguardando família, 3 dias exatos volta para Agir agora", () => {
  const now = Date.parse("2026-11-10T15:00:00Z");
  const asked = "2026-11-01T00:00:00Z";
  const mk = (sentAt: string) =>
    buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt }], pipeline: P({ planAskedMoreDocsAt: asked }) }), now);
  const justUnder = mk(new Date(now - 2.99 * DAY).toISOString());
  assert.equal(justUnder.group, "familia");
  assert.equal(justUnder.step.kind, "wait_family");
  const exact = mk(new Date(now - 3 * DAY).toISOString());
  assert.equal(exact.group, "agir");
  assert.equal(exact.step.kind, "plan_more_docs");
  assert.match(exact.step.listText, /sem resposta há 3 dias/);
});

test("negativa e pedido de documentos juntos: vale o mais recente, e empate fica com a negativa", () => {
  const later = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ planDeniedAt: ago(3), planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(later.planOutcome, "more_docs");
  assert.equal(later.step.kind, "plan_more_docs");
  const earlier = buildFilaItem(src({ pipeline: P({ planDeniedAt: ago(1), planAskedMoreDocsAt: ago(3) }) }), NOW);
  assert.equal(earlier.planOutcome, "denied");
  assert.equal(earlier.step.kind, "send_guide");
  const tie = buildFilaItem(src({ pipeline: P({ planDeniedAt: ago(1), planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(tie.planOutcome, "denied");
  assert.equal(tie.step.listText, "Plano negou: enviar a guia de novo");
});

test("autorização dispensada depois da negativa limpa a resposta do plano", () => {
  const i = buildFilaItem(src({ pipeline: P({ authorization: "dispensada", planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.planOutcome, null);
  assert.equal(i.planOutcomeAt, null);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "enable_scheduling");
});

test("negativa com cobrança de documento continua em Agir agora, enviar a guia", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(0.5) }], pipeline: P({ planDeniedAt: ago(1) }) }), NOW);
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.equal(i.step.listText, "Plano negou: enviar a guia de novo");
});

test("habilitado com pedido de documentos do plano: Concluídos, sem resposta do plano", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ schedulingEnabledAt: ago(0), planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.group, "concluidos");
  assert.equal(i.step.kind, "with_supervision");
  assert.equal(i.planOutcome, null);
});

test("pediu mais documentos com autorização 'enviada' e guia anterior ao pedido: Agir agora, pedir documentos", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [LAUDO], pipeline: P({ authorization: "enviada", guideSentAt: ago(5), planAskedMoreDocsAt: ago(1) }) }), NOW);
  assert.equal(i.planOutcome, "more_docs");
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "plan_more_docs");
  assert.equal(i.step.primaryLabel, "Pedir documentos à família");
});

test("trailStates sem planOutcome mantém o comportamento antigo", () => {
  assert.deepEqual(trailStates({ authorization: "pendente", schedulingEnabledAt: null, missingCount: 0 }), ["done", "current", "locked", "locked"]);
  assert.deepEqual(trailStates({ authorization: "pendente", schedulingEnabledAt: null, missingCount: 1 }), ["current", "locked", "locked", "locked"]);
  assert.deepEqual(trailStates({ authorization: "pendente", schedulingEnabledAt: null, missingCount: 0, planOutcome: null }), ["done", "current", "locked", "locked"]);
});
