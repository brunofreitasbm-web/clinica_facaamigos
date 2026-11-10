// tests/fila-model-pure.test.ts
//
// Modelo da Fila de entrada (/recepcao/fila): em que grupo cada família está, qual é o próximo passo,
// há quanto tempo espera e como filtrar. Regra pura, sem banco.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
  const i = buildFilaItem(src({ pipeline: { authorization: "autorizada", schedulingEnabledAt: ago(1), returned: null } }));
  assert.equal(i.group, "concluidos");
  assert.equal(i.step.kind, "with_supervision");
  assert.equal(i.step.primaryLabel, null);
  assert.match(i.step.listText, /Supervisão/);
});

test("guia enviada ao plano: Aguardando plano, e o botão é registrar a resposta", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "enviada", schedulingEnabledAt: null, returned: null } }));
  assert.equal(i.group, "plano");
  assert.equal(i.step.kind, "wait_plan");
  assert.equal(i.step.primaryLabel, "Plano autorizou");
});

test("faltam documentos e nada foi pedido: Agir agora, pedir à família", () => {
  const i = buildFilaItem(src({ missingCount: 2, missingDocs: [LAUDO, CART] }));
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
  );
  assert.equal(i.group, "familia");
  assert.equal(i.step.kind, "wait_family");
  assert.equal(i.step.listText, "Família precisa enviar: laudo médico, carteirinha");
  assert.equal(i.step.primaryLabel, "Enviar lembrete");
  assert.deepEqual(i.remindKeys, ["laudo_medico", "carteirinha"]);
});

test("parte dos documentos pedida: continua em Agir agora, só pede o que não foi pedido", () => {
  const i = buildFilaItem(
    src({ missingCount: 2, missingDocs: [LAUDO, CART], documentRequests: [{ key: "laudo_medico", sentAt: ago(1) }] })
  );
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "ask_documents");
  assert.deepEqual(i.askKeys, ["carteirinha"]);
});

test("falta só dado (nada que se possa cobrar da família): conferir o cadastro", () => {
  const i = buildFilaItem(src({ missingCount: 1, missingDocs: [] }));
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "review_data");
  assert.deepEqual(i.askKeys, []);
});

test("documentos completos e guia não enviada: registrar guia enviada", () => {
  const i = buildFilaItem(src());
  assert.equal(i.group, "agir");
  assert.equal(i.step.kind, "send_guide");
  assert.equal(i.step.primaryLabel, "Registrar guia enviada");
});

test("plano autorizou e falta habilitar: habilitar agendamento", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "autorizada", schedulingEnabledAt: null, returned: null } }));
  assert.equal(i.step.kind, "enable_scheduling");
  assert.equal(i.step.primaryLabel, "Habilitar agendamento");
});

test("particular (autorização dispensada) também chega a habilitar agendamento", () => {
  const i = buildFilaItem(src({ pipeline: { authorization: "dispensada", schedulingEnabledAt: null, returned: null } }));
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
  );
  assert.equal(i.step.kind, "ask_documents");
});

test("habilitado vence tudo: não volta para a fila por um documento detectado depois", () => {
  const i = buildFilaItem(
    src({
      missingCount: 1,
      missingDocs: [LAUDO],
      pipeline: { authorization: "autorizada", schedulingEnabledAt: ago(1), returned: null },
    })
  );
  assert.equal(i.group, "concluidos");
});

test("devolvido pela Supervisão aparece como aviso e volta para Agir agora", () => {
  const i = buildFilaItem(
    src({ pipeline: { authorization: "autorizada", schedulingEnabledAt: null, returned: { reason: "Guia ilegível", byName: "Carla" } } })
  );
  assert.equal(i.group, "agir");
  assert.deepEqual(i.returned, { reason: "Guia ilegível", byName: "Carla" });
});

test("responsável e plano vêm dos dados lidos; sem eles, nulo (nunca inventado)", () => {
  const i = buildFilaItem(src());
  assert.equal(i.guardian, "Carla Rocha");
  assert.equal(i.plan, "IASEP");
  const semDados = buildFilaItem(src({ facts: [] }));
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
  const a = buildFilaItem(src({ id: "a", createdAt: ago(2) }));
  const b = buildFilaItem(src({ id: "b", createdAt: ago(9) }));
  const c = buildFilaItem(src({ id: "c", createdAt: ago(20), postponed: true }));
  assert.deepEqual(sortFila([a, c, b]).map((x) => x.id), ["b", "a", "c"]);
});

const lista = [
  buildFilaItem(src({ id: "1", patientName: "Nina Rocha Bastos", assignedToId: "eu" })),
  buildFilaItem(
    src({
      id: "2",
      patientName: "Théo Lacerda Nunes",
      sourcePhone: "+5591900000107",
      facts: [{ label: "Responsável", value: "Bruna Lacerda" }],
      assignedToId: "outra",
      pipeline: { authorization: "enviada", schedulingEnabledAt: null, returned: null },
    })
  ),
  buildFilaItem(
    src({ id: "3", patientName: "Lívia Prado", assignedToId: "eu", missingCount: 1, missingDocs: [LAUDO], documentRequests: [{ key: "laudo_medico", sentAt: ago(1) }] })
  ),
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
