// perf/intake-payload-estimate.mjs
//
// Estimativa ESTÁTICA do payload serializado que a Fila de entrada manda ao navegador, por caso, antes e
// depois da lista leve. Não precisa de banco: monta um caso representativo sintético (tamanho típico de
// um lead de WhatsApp com 4 arquivos, 14 dados, 20 mensagens) e mede o JSON.
//
//   node --experimental-strip-types perf/intake-payload-estimate.mjs
//
// Formas comparadas:
//   A) commit 5dc43a2: items com `detail` (painel montado no servidor) + a fila completa (`queue`).
//      O tamanho do `detail` (RSC) depende do render real e NÃO entra aqui: o total de A é um piso.
//   B) início da tarefa 6 (59eeec9): items sem `detail` + a fila completa.
//   C) agora: só a lista leve (toIntakeListItem).
import { toIntakeListItem } from "../app/recepcao/a-autorizar/intake-list-item-pure.ts";

const NOW = "2026-11-10T12:00:00.000Z";
const iso = (d) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

const draft = {
  id: "7f0c2d9e-5b1a-4c3e-9a77-0d2f8b6e1a42",
  patientId: "3a9c1e55-8d24-4f6b-b0c1-52e9d7a4f310",
  patientName: "Maria Eduarda Souza Lima",
  patientStatus: "interessado",
  sourcePhone: "5511987654321",
  source: "whatsapp",
  status: "extracted",
  pipeline: {
    authorization: "enviada",
    guideSentAt: iso(3),
    guideSentByName: "Ana Paula Ribeiro",
    authorizedAt: null,
    authorizedByName: null,
    authorizedGuide: null,
    authorizationId: null,
    schedulingEnabledAt: null,
    returned: null,
    planDeniedAt: null,
    planAskedMoreDocsAt: null,
    suggestedGuide: {
      guide_number: "202611100045",
      procedure_code: "50000470",
      sessions_authorized: 24,
      valid_from: "2026-11-01",
      valid_to: "2027-02-01",
      authorization_password: "ABC123XYZ",
      password_valid_until: "2027-02-01",
      procedures: [
        { code: "50000470", description: "Sessão de fonoaudiologia", quantity: 24 },
        { code: "50000550", description: "Sessão de terapia ocupacional", quantity: 24 },
      ],
    },
    registered: false,
  },
  createdAt: iso(9),
  guardianMessage: "Boa tarde, segue o pedido médico e a carteirinha do convênio da Maria Eduarda, ela tem 5 anos.",
  files: Array.from({ length: 4 }, (_, i) => ({
    id: `f0c2d9e5-b1a4-4c3e-9a77-0d2f8b6e1a4${i}`,
    name: `IMG-2026110${i}-WA00${i}.jpg`,
    mimeType: "image/jpeg",
    detectedType: ["carteirinha", "pedido_medico", "documento_responsavel", "laudo"][i],
  })),
  facts: [
    ["Criança", "Maria Eduarda Souza Lima"],
    ["Nascimento", "12/03/2021"],
    ["CPF da criança", "123.456.789-09"],
    ["CID", "F84.0"],
    ["Responsável", "Carla Souza Lima"],
    ["CPF do responsável", "987.654.321-00"],
    ["Telefone", "(11) 98765-4321"],
    ["E-mail", "carla.souza@exemplo.com.br"],
    ["Convênio", "Plano de Saúde Exemplo"],
    ["Carteirinha", "0 123 456789012345 6"],
    ["Plano", "Exemplo Pleno Nacional"],
    ["Médico solicitante", "Dr. Paulo Henrique Andrade"],
    ["CRM", "123456/SP"],
    ["Terapias pedidas", "Fonoaudiologia, terapia ocupacional"],
  ].map(([label, value]) => ({ label, value })),
  warnings: ["Nome na carteirinha difere do nome no pedido médico"],
  error: null,
  messages: Array.from({ length: 20 }, (_, i) => ({
    direction: i % 2 ? "outbound" : "inbound",
    body: i % 2
      ? "Recebemos os documentos. Vamos conferir com o plano e voltamos com o retorno em breve."
      : "Ok, obrigada! Posso mandar mais alguma coisa para agilizar o agendamento da avaliação?",
    sentAt: iso(9 - i * 0.4),
    hasMedia: i % 5 === 0,
  })),
  documentRequests: [
    { key: "laudo", sentAt: iso(6) },
    { key: "documento_responsavel", sentAt: iso(4) },
  ],
  pendencies: {
    pills: [
      "Carteirinha",
      "Pedido médico",
      "Documento do responsável",
      "Laudo",
      "Nome da criança",
      "Nascimento",
      "CPF da criança",
      "Responsável",
      "Convênio",
    ].map((label, i) => ({
      key: label.toLowerCase().replace(/\s+/g, "_"),
      label,
      group: i < 4 ? "documento" : "dado",
      state: i === 3 ? "faltando" : "ok",
      detail: i === 3 ? "família disse que não tem" : undefined,
      chaseKey: i === 3 ? "laudo" : undefined,
    })),
    hasPlan: true,
    missingCount: 1,
    summary: "Falta o laudo",
  },
  intake: { stage: "aguardar_plano", label: "3 de 4 · Aguardar plano", group: "aguardando_plano", waitingSince: iso(3) },
};

const queueItem = {
  id: `cadastro-ia-${draft.id}`,
  category: "cadastro_assistido_ia",
  categoryLabel: "Contatos do WhatsApp - dados e documentos",
  patientId: draft.patientId,
  patientName: draft.patientName,
  detail: "Documentos recebidos há 9 dias, guia enviada ao plano há 3 dias",
  urgencyLabel: "9 dias",
  href: `/recepcao/pre-cadastros/${draft.id}`,
  draftId: draft.id,
  draft,
  assignedToId: "b1c2d3e4-f5a6-4789-8abc-def012345678",
  assignedToName: "Ana Paula Ribeiro",
  dueAt: iso(-1),
  escalatedAt: null,
  overdue: false,
};

const workspaceItem = {
  id: queueItem.id,
  category: queueItem.category,
  categoryLabel: queueItem.categoryLabel,
  name: draft.patientName,
  band: "hoje",
  overdue: false,
  escalated: false,
  dueAt: queueItem.dueAt,
  dueText: "amanhã 18:00",
  ownerId: queueItem.assignedToId,
  ownerName: queueItem.assignedToName,
  stage: "autorizacao",
  missingCount: 1,
  mine: true,
  haystack: ["maria eduarda souza lima", "5511987654321", ...draft.facts.map((f) => f.value.toLowerCase()), "falta laudo"].join(" · "),
  readDraftId: null,
};

const bytes = (v) => Buffer.byteLength(JSON.stringify(v));
const sizes = {
  items: bytes(workspaceItem),
  fila: bytes(queueItem),
  B_total: bytes(workspaceItem) + bytes(queueItem),
  C_total: bytes(toIntakeListItem(workspaceItem, draft, NOW)),
};
const rows = [
  ["A  5dc43a2: items + queue + `detail` RSC (piso: o `detail` não é medido aqui)", sizes.B_total],
  ["B  59eeec9: items sem detail + queue completa", sizes.B_total],
  ["C  agora: lista leve (toIntakeListItem)", sizes.C_total],
];
const cases = [1, 50, 100];
console.log("Payload serializado por caso (JSON de um caso representativo sintético):");
for (const [label, n] of rows) console.log(`- ${label}: ${n} bytes`);
console.log(`- Detalhe sob demanda (draft completo, 1 caso aberto): ${bytes(draft)} bytes`);
console.log("");
console.log("Total estimado da página por número de casos (bytes):");
for (const n of cases) {
  console.log(`- ${n} caso(s): B = ${sizes.B_total * n}, C = ${sizes.C_total * n} (+ ${bytes(draft)} do caso aberto), economia ${(100 * (1 - (sizes.C_total * n + bytes(draft)) / (sizes.B_total * n))).toFixed(0)}%`);
}
console.log("");
console.log(JSON.stringify({ perCase: sizes, detailOnDemand: bytes(draft) }));
