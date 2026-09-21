// tests/lead-pendencies.test.ts
//
// Motor do "o que falta" de um contato do WhatsApp na fila de Pendências
// (lib/lead-pendencies.ts): particular x convênio, guia como aviso, resposta
// digitada x leitura da IA, documentos que entraram depois pelo paciente-lead.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeLeadPendencies,
  isBotDatumPresent,
  mergeBotCollectedIntoExtraction,
  missingChaseKeys,
  pickBotCollected,
  visiblePills,
  type LeadPendenciesInput,
} from "../lib/lead-pendencies.ts";
import { computeCompleteness } from "../lib/whatsapp-leads-view.ts";

const base: LeadPendenciesInput = {
  extracted: null,
  bot: null,
  fileTypes: [],
  patientDocCategories: [],
  insurerKnown: false,
  authorizationWaived: false,
  planAuthorizedAt: null,
  hasAuthorizedGuide: false,
  draftStatus: "extracted",
  filesCount: 0,
};

const stateOf = (result: ReturnType<typeof computeLeadPendencies>, key: string) =>
  result.pills.find((p) => p.key === key)?.state;

const fullBot = {
  guardian_name: "Maria Silva",
  guardian_cpf: "12345678901",
  guardian_email: "maria@exemplo.com",
  child_name: "João Silva",
  child_birth_date: "2018-03-15",
  is_private: false,
  card_number: "0123456789",
};

test("isBotDatumPresent: started_at sozinho não é dado", () => {
  assert.equal(isBotDatumPresent({ started_at: "2026-09-21T10:00:00Z" }), false);
  assert.equal(isBotDatumPresent({}), false);
  assert.equal(isBotDatumPresent(null), false);
  assert.equal(isBotDatumPresent({ started_at: "x", guardian_name: "Maria Silva" }), true);
  assert.equal(isBotDatumPresent({ laudo_pdf_url: "storage://clinic-documents/x.pdf" }), true);
});

test("pickBotCollected guarda o e-mail vazio (recusou duas vezes) e ignora o resto", () => {
  const picked = pickBotCollected(
    { started_at: "x", guardian_name: "Maria Silva", guardian_email: "", available_slots: [{}], guardian_email_asked_again: true, is_private: false },
    "awaiting_child_name",
  );
  assert.deepEqual(picked, { guardian_name: "Maria Silva", guardian_email: "", is_private: false, last_step: "awaiting_child_name" });
});

test("mergeBotCollectedIntoExtraction: digitado vence a IA, vazio não apaga", () => {
  const merged = mergeBotCollectedIntoExtraction(
    { patient: { full_name: "JOAO S", cid: "F84.0" }, guardian: { email: "ia@leu.com" }, warnings: ["x"] },
    { child_name: "João Silva", guardian_email: "", card_number: "999888" },
  ) as Record<string, Record<string, unknown>>;
  assert.equal(merged.patient.full_name, "João Silva");
  assert.equal(merged.patient.cid, "F84.0");
  assert.equal(merged.guardian.email, "ia@leu.com");
  assert.equal(merged.insurance.card_number, "999888");
  assert.deepEqual((merged as unknown as { warnings: string[] }).warnings, ["x"]);
});

test("lead sem nada: todos os dados e documentos de convênio faltam; guia é só aviso", () => {
  const result = computeLeadPendencies(base);
  assert.equal(stateOf(result, "laudo"), "faltando");
  assert.equal(stateOf(result, "carteirinha"), "faltando");
  assert.equal(stateOf(result, "doc_responsavel"), "faltando");
  assert.equal(stateOf(result, "pedido_medico"), "faltando");
  assert.equal(stateOf(result, "guia"), "aviso");
  // 4 documentos + criança, nascimento, responsável, CPF, e-mail, convênio/cartão
  assert.equal(result.missingCount, 10);
  assert.match(result.summary, /^Faltam 10:/);
});

test("guia ausente NUNCA entra no Faltam N nem gera cobrança", () => {
  const result = computeLeadPendencies(base);
  assert.equal(result.pills.find((p) => p.key === "guia")?.label, "Guia: clínica autoriza");
  assert.equal(missingChaseKeys(result).includes("laudo_medico"), true);
  assert.equal(result.pills.find((p) => p.key === "guia")?.chaseKey, undefined);
});

test("guia vira ok com documento de autorização, guia registrada ou plano autorizado", () => {
  assert.equal(stateOf(computeLeadPendencies({ ...base, fileTypes: ["autorizacao"] }), "guia"), "ok");
  assert.equal(stateOf(computeLeadPendencies({ ...base, patientDocCategories: ["autorizacao"] }), "guia"), "ok");
  assert.equal(stateOf(computeLeadPendencies({ ...base, hasAuthorizedGuide: true }), "guia"), "ok");
  assert.equal(stateOf(computeLeadPendencies({ ...base, planAuthorizedAt: "2026-09-21T10:00:00Z" }), "guia"), "ok");
  assert.equal(stateOf(computeLeadPendencies({ ...base, bot: { guia_pdf_url: "storage://clinic-documents/g.pdf" } }), "guia"), "ok");
});

test("particular: sem carteirinha/guia/convênio; laudo e pedido viram aviso; RG e dados contam", () => {
  const result = computeLeadPendencies({ ...base, bot: { ...fullBot, is_private: true, card_number: undefined } });
  assert.equal(stateOf(result, "carteirinha"), "nao_se_aplica");
  assert.equal(stateOf(result, "guia"), "nao_se_aplica");
  assert.equal(stateOf(result, "convenio_cartao"), "nao_se_aplica");
  assert.equal(stateOf(result, "laudo"), "aviso");
  assert.equal(stateOf(result, "pedido_medico"), "aviso");
  assert.equal(stateOf(result, "doc_responsavel"), "faltando");
  assert.equal(result.missingCount, 1);
  assert.equal(visiblePills(result).some((p) => p.state === "nao_se_aplica"), false);
});

test("particular com laudo enviado: laudo fica ok", () => {
  const result = computeLeadPendencies({ ...base, bot: { is_private: true }, fileTypes: ["laudo"] });
  assert.equal(stateOf(result, "laudo"), "ok");
});

test("sem resposta do bot, 'sem guia' marcado pela recepção vale como particular", () => {
  const result = computeLeadPendencies({ ...base, authorizationWaived: true });
  assert.equal(stateOf(result, "carteirinha"), "nao_se_aplica");
});

test("convênio + 'sem guia' da recepção: carteirinha continua exigida, guia some", () => {
  const result = computeLeadPendencies({ ...base, bot: { is_private: false }, authorizationWaived: true });
  assert.equal(stateOf(result, "carteirinha"), "faltando");
  assert.equal(stateOf(result, "guia"), "nao_se_aplica");
});

test("resposta digitada vence a leitura da IA", () => {
  const result = computeLeadPendencies({
    ...base,
    bot: { child_name: "João Silva" },
    extracted: { patient: { full_name: "OUTRO NOME", birth_date: "2018-03-15" } },
  });
  assert.equal(stateOf(result, "crianca"), "ok");
  assert.equal(stateOf(result, "nascimento"), "ok");
});

test("e-mail recusado (vazio) continua faltando", () => {
  const result = computeLeadPendencies({ ...base, bot: { ...fullBot, guardian_email: "" } });
  assert.equal(stateOf(result, "email"), "faltando");
});

test("união: documento que entrou depois pelo paciente-lead acende a pílula", () => {
  const result = computeLeadPendencies({
    ...base,
    bot: fullBot,
    insurerKnown: true,
    fileTypes: ["carteirinha"],
    patientDocCategories: ["laudo", "documento_identidade", "pedido_medico"],
  });
  assert.equal(result.missingCount, 0);
  assert.equal(result.summary, "Dados e documentos completos");
});

test("documento_responsavel (checklist de entrada) também vale como RG do responsável", () => {
  assert.equal(stateOf(computeLeadPendencies({ ...base, patientDocCategories: ["documento_responsavel"] }), "doc_responsavel"), "ok");
});

test("bot: 'não tenho laudo' vira detalhe da pílula, que continua faltando", () => {
  const result = computeLeadPendencies({ ...base, bot: { ...fullBot, has_laudo: false } });
  const laudo = result.pills.find((p) => p.key === "laudo");
  assert.equal(laudo?.state, "faltando");
  assert.match(laudo?.detail ?? "", /não tem/);
});

test("analisando: só documento sem evidência com leitura pendente e arquivos", () => {
  const reading = computeLeadPendencies({ ...base, draftStatus: "pending", filesCount: 2 });
  assert.equal(stateOf(reading, "laudo"), "analisando");
  assert.equal(stateOf(reading, "crianca"), "faltando");
  assert.equal(reading.missingCount, 6); // 6 dados; documentos ainda em análise
  const noFiles = computeLeadPendencies({ ...base, draftStatus: "pending", filesCount: 0 });
  assert.equal(stateOf(noFiles, "laudo"), "faltando");
  // Documento declarado pelo bot é definitivo mesmo com leitura pendente.
  const declared = computeLeadPendencies({
    ...base,
    draftStatus: "pending",
    filesCount: 1,
    bot: { laudo_pdf_url: "storage://clinic-documents/l.pdf" },
  });
  assert.equal(stateOf(declared, "laudo"), "ok");
});

test("convênio sem plano identificado: cartão digitado, mas falta informar o plano", () => {
  const result = computeLeadPendencies({ ...base, bot: fullBot, insurerKnown: false });
  const pill = result.pills.find((p) => p.key === "convenio_cartao");
  assert.equal(pill?.state, "faltando");
  assert.match(pill?.detail ?? "", /plano/);
});

test("ordem: faltando, aviso, analisando, ok, não se aplica (documentos antes de dados)", () => {
  const result = computeLeadPendencies({ ...base, bot: { ...fullBot, is_private: true }, fileTypes: ["laudo"] });
  const rank = { faltando: 0, aviso: 1, analisando: 2, ok: 3, nao_se_aplica: 4 } as const;
  const ranks = result.pills.map((p) => rank[p.state]);
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks);
  // Dentro do mesmo estado, os documentos vêm antes dos dados.
  const oks = result.pills.filter((p) => p.state === "ok").map((p) => p.group);
  assert.deepEqual(oks, [...oks].sort((a, b) => (a === b ? 0 : a === "documento" ? -1 : 1)));
});

test("paridade com computeCompleteness: mesmos dados faltantes (exceto criança)", () => {
  const cases = [
    { bot: {}, hasInsurance: false },
    { bot: { ...fullBot, guardian_cpf: undefined }, hasInsurance: true },
    { bot: { ...fullBot, guardian_email: "" }, hasInsurance: true },
    { bot: { ...fullBot, is_private: true }, hasInsurance: false },
    { bot: { ...fullBot, card_number: undefined }, hasInsurance: true },
    { bot: fullBot, hasInsurance: false },
  ];
  for (const c of cases) {
    const pend = computeLeadPendencies({ ...base, bot: c.bot, insurerKnown: c.hasInsurance });
    const fromPills = pend.pills
      .filter((p) => p.group === "dado" && p.state === "faltando" && p.key !== "crianca")
      .map((p) => p.label.toLowerCase())
      .sort();
    const completeness = computeCompleteness({
      birthDate: (c.bot as Record<string, string | undefined>).child_birth_date ?? null,
      guardianName: (c.bot as Record<string, string | undefined>).guardian_name ?? null,
      guardianCpf: (c.bot as Record<string, string | undefined>).guardian_cpf ?? null,
      guardianEmail: (c.bot as Record<string, string | undefined>).guardian_email ?? null,
      hasInsurance: c.hasInsurance,
      isPrivate: (c.bot as Record<string, unknown>).is_private === true,
      cardNumber: (c.bot as Record<string, string | undefined>).card_number ?? null,
    });
    assert.deepEqual(fromPills, [...completeness.missing].map((m) => m.toLowerCase()).sort());
  }
});

test("chaves de cobrança batem com MISSING_DOCUMENT_TEMPLATES", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../lib/document-request-templates.ts", import.meta.url), "utf8");
  const keys = [...source.matchAll(/key: "([a-z_]+)"/g)].map((m) => m[1]);
  const result = computeLeadPendencies(base);
  for (const chaseKey of missingChaseKeys(result)) {
    assert.ok(keys.includes(chaseKey), `modelo de cobrança "${chaseKey}" não existe em MISSING_DOCUMENT_TEMPLATES`);
  }
  for (const literal of ["laudo_medico", "pedido_medico", "carteirinha", "documento_responsavel"]) {
    assert.ok(keys.includes(literal), literal);
  }
});
