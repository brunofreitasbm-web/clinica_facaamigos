// tests/portal-robot-pure.test.ts
//
// Robô de autorização no portal do plano: validação do pedido, mês de
// referência, agente ligado e transições de status (lib/portal-robot-pure.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAgentFinish,
  canCancel,
  formatReferenceMonth,
  isAgentOnline,
  laudoMimeFromPath,
  normalizeAgentName,
  normalizeRequest,
  suggestedReferenceMonth,
  type PortalRobotRequestInput,
} from "../lib/portal-robot-pure.ts";

const base: PortalRobotRequestInput = {
  mode: "autorizar",
  cardNumber: "9945 603",
  cid: "f84.0",
  referenceMonth: "2026-12",
  professional: { name: "  edson   bechara ", council: "crm", register: "11.127", uf: "pa", cbo: "225112" },
  procedures: [{ code: "80011186", description: "Psicologia", quantity: "4" }, { code: "", description: "", quantity: "" }],
  laudoFileId: "file-1",
};

test("normaliza carteirinha, CID, médico e terapias", () => {
  const r = normalizeRequest(base);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.card_number, "9945603");
  assert.equal(r.value.cid, "F84.0");
  assert.deepEqual(r.value.professional, { name: "EDSON BECHARA", council: "CRM", register: "11127", uf: "PA", cbo: "225112" });
  assert.deepEqual(r.value.procedures, [{ code: "80011186", description: "Psicologia", quantity: 4 }]);
});

test("CID-11 (6A02) é recusado com explicação", () => {
  const r = normalizeRequest({ ...base, cid: "6A02" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /CID-10/);
});

test("sem terapia, sem laudo, CBO curto ou mês inválido: erro", () => {
  assert.equal(normalizeRequest({ ...base, procedures: [] }).ok, false);
  assert.equal(normalizeRequest({ ...base, laudoFileId: "" }).ok, false);
  assert.equal(normalizeRequest({ ...base, professional: { ...base.professional, cbo: "2251" } }).ok, false);
  assert.equal(normalizeRequest({ ...base, referenceMonth: "2026-13" }).ok, false);
  assert.equal(normalizeRequest({ ...base, procedures: [{ code: "80011186", description: "", quantity: 0 }] }).ok, false);
});

test("mês sugerido: a partir do dia 15 vale o mês seguinte", () => {
  assert.equal(suggestedReferenceMonth(new Date("2026-11-14T15:00:00Z")), "2026-11");
  assert.equal(suggestedReferenceMonth(new Date("2026-11-15T15:00:00Z")), "2026-12");
  assert.equal(suggestedReferenceMonth(new Date("2026-12-20T15:00:00Z")), "2027-01");
});

test("agente ligado só com sinal recente", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  assert.equal(isAgentOnline("2026-11-06T11:59:10Z", now), true);
  assert.equal(isAgentOnline("2026-11-06T11:50:00Z", now), false);
  assert.equal(isAgentOnline(null, now), false);
});

test("enviado/verificar só depois da confirmação; simulado só no modo simular", () => {
  assert.equal(canAgentFinish("confirmado", "enviado", "autorizar"), true);
  assert.equal(canAgentFinish("aguardando_confirmacao", "enviado", "autorizar"), false);
  assert.equal(canAgentFinish("em_andamento", "verificar", "autorizar"), false);
  assert.equal(canAgentFinish("aguardando_confirmacao", "simulado", "simular"), true);
  assert.equal(canAgentFinish("aguardando_confirmacao", "simulado", "autorizar"), false);
  assert.equal(canAgentFinish("em_andamento", "erro", "autorizar"), true);
  assert.equal(canAgentFinish("confirmado", "erro", "autorizar"), false);
});

test("cancelar só antes da confirmação", () => {
  assert.equal(canCancel("aguardando_confirmacao"), true);
  assert.equal(canCancel("confirmado"), false);
  assert.equal(canCancel("enviado"), false);
});

test("formata o mês de referência", () => {
  assert.equal(formatReferenceMonth("2026-12"), "dez/2026");
  assert.equal(formatReferenceMonth(null), "—");
});

test("nome do computador do robô: espaços normalizados, vazio e longo recusados", () => {
  assert.deepEqual(normalizeAgentName("  Computador   da recepção "), { ok: true, value: "Computador da recepção" });
  assert.equal(normalizeAgentName("").ok, false);
  assert.equal(normalizeAgentName(null).ok, false);
  assert.equal(normalizeAgentName("x".repeat(61)).ok, false);
});

test("anexo do laudo: só PDF, JPG e PNG, pelo nome do arquivo", () => {
  assert.equal(laudoMimeFromPath("p1/doc/Laudo_Final.PDF"), "application/pdf");
  assert.equal(laudoMimeFromPath("x/foto.jpeg"), "image/jpeg");
  assert.equal(laudoMimeFromPath("x/foto.png"), "image/png");
  assert.equal(laudoMimeFromPath("x/foto.heic"), null);
  assert.equal(laudoMimeFromPath("sem-extensao"), null);
});
