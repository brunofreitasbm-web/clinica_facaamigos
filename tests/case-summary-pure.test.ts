// tests/case-summary-pure.test.ts
//
// Resumo do caso no painel lateral do Chat: quem é, plano, etapa, por que está com a equipe e o próximo passo.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageLabel,
  buildCaseSummary,
  escalationLabel,
  parseBirthDate,
  type CaseSummaryInput,
} from "../lib/atendimento/case-summary-pure.ts";

const NOW = Date.parse("2026-11-09T15:00:00Z");

test("nascimento aceita ISO e dd/mm/aaaa; lixo vira null", () => {
  assert.equal(parseBirthDate("2022-03-15"), "2022-03-15");
  assert.equal(parseBirthDate("15/03/2022"), "2022-03-15");
  assert.equal(parseBirthDate("5/3/2022"), "2022-03-05");
  assert.equal(parseBirthDate("2022-03-15T00:00:00Z"), "2022-03-15");
  assert.equal(parseBirthDate("32/13/2022"), null);
  assert.equal(parseBirthDate("ontem"), null);
  assert.equal(parseBirthDate(""), null);
  assert.equal(parseBirthDate(null), null);
});

test("idade: anos, ano e meses, só meses", () => {
  assert.equal(ageLabel("2022-03-15", NOW), "4 anos");
  assert.equal(ageLabel("2025-03-09", NOW), "1 ano e 8 meses");
  assert.equal(ageLabel("2026-01-09", NOW), "10 meses");
  assert.equal(ageLabel("2026-10-20", NOW), "menos de 1 mês");
  assert.equal(ageLabel("2030-01-01", NOW), null, "data no futuro não gera idade");
  assert.equal(ageLabel(null, NOW), null);
});

test("motivo da escalação em português; desconhecido e nulo não quebram", () => {
  assert.match(escalationLabel("pediu_humano") ?? "", /pediu para falar/);
  assert.match(escalationLabel("particular_agendar") ?? "", /particular/i);
  assert.equal(escalationLabel("motivo_novo"), null);
  assert.equal(escalationLabel(null), null);
});

const leadBase: CaseSummaryInput = {
  conversation: {
    kind: "lead",
    phoneNumber: "+5591988470999",
    displayName: "Ana",
    contactName: "Ana",
    guardianName: null,
    planName: null,
    escalationReason: null,
    patientId: null,
    patientStatus: null,
  },
  draft: null,
  patient: null,
  insurance: [],
  nowMs: NOW,
};

test("lead sem rascunho: só o que se sabe, sem inventar", () => {
  const s = buildCaseSummary(leadBase);
  assert.equal(s.headline, "Ana");
  assert.deepEqual(s.plan, { text: "Plano não informado", tone: "unknown" });
  assert.equal(s.stage, null);
  assert.equal(s.reason, null);
  // Sem rascunho, "Resolver pendências" é o que abre o lead na fila (comportamento que já existia).
  assert.equal(s.next.kind, "resolve_pendencies");
});

test("lead com dados lidos: criança, idade, responsável e plano vêm do rascunho", () => {
  const s = buildCaseSummary({
    ...leadBase,
    draft: {
      id: "d1",
      status: "extracted",
      facts: [
        { label: "Criança", value: "Heitor Magno Ramos" },
        { label: "Nascimento", value: "15/03/2022" },
        { label: "Responsável", value: "Ana Ramos" },
        { label: "Vínculo", value: "mãe" },
        { label: "Plano de saúde", value: "Unimed" },
        { label: "Plano", value: "Nacional" },
      ],
      pipeline: { authorization: "pendente", schedulingEnabledAt: null, registered: false, returned: null },
      missingCount: 2,
      missingSummary: "Faltam carteirinha e laudo",
      filesCount: 1,
      stage: { label: "Pedir à família: carteirinha, laudo médico", allDone: false },
    },
  });
  assert.equal(s.headline, "Heitor Magno Ramos");
  assert.deepEqual(s.details, [
    { label: "Idade", value: "4 anos (15/03/2022)" },
    { label: "Responsável", value: "Ana Ramos (mãe)" },
  ]);
  assert.deepEqual(s.plan, { text: "Unimed · Nacional", tone: "known" });
  assert.deepEqual(s.stage, { label: "Pedir à família: carteirinha, laudo médico", allDone: false });
  assert.equal(s.next.kind, "resolve_pendencies");
  assert.match(s.next.note ?? "", /Faltam carteirinha e laudo/);
});

test("sem pendência e autorização ainda não concluída: próximo passo é Autorizações com o rascunho em foco", () => {
  const s = buildCaseSummary({
    ...leadBase,
    draft: {
      id: "d9",
      status: "extracted",
      facts: [],
      pipeline: { authorization: "enviada", schedulingEnabledAt: null, registered: false, returned: null },
      missingCount: 0,
      missingSummary: "",
      filesCount: 3,
      stage: { label: "Plano analisando a guia", allDone: false },
    },
  });
  assert.equal(s.next.kind, "open_authorization");
  assert.equal(s.next.href, "/recepcao/a-autorizar?item=d9");
});

test("habilitado para agendar: etapa concluída e sem botão primário", () => {
  const s = buildCaseSummary({
    ...leadBase,
    draft: {
      id: "d2",
      status: "validated",
      facts: [],
      pipeline: { authorization: "autorizada", schedulingEnabledAt: "2026-11-09T10:00:00Z", registered: true, returned: null },
      missingCount: 0,
      missingSummary: "",
      filesCount: 3,
      stage: { label: "Com a Supervisão para marcar a 1ª avaliação", allDone: true },
    },
  });
  assert.deepEqual(s.stage, { label: "Com a Supervisão para marcar a 1ª avaliação", allDone: true });
  assert.equal(s.next.kind, "none");
  assert.match(s.next.note ?? "", /pronto para agendar/i);
});

test("devolvido pela supervisão aparece como aviso", () => {
  const s = buildCaseSummary({
    ...leadBase,
    draft: {
      id: "d3",
      status: "extracted",
      facts: [],
      pipeline: {
        authorization: "pendente",
        schedulingEnabledAt: null,
        registered: false,
        returned: { reason: "Guia ilegível", byName: "Carla" },
      },
      missingCount: 0,
      missingSummary: "",
      filesCount: 1,
      stage: { label: "Enviar a guia ao plano", allDone: false },
    },
  });
  assert.match(s.warning ?? "", /Guia ilegível/);
});

test("paciente: plano do cadastro, idade do cadastro e link da ficha", () => {
  const s = buildCaseSummary({
    ...leadBase,
    conversation: {
      ...leadBase.conversation,
      kind: "patient",
      guardianName: "Vanessa Alcântara",
      patientId: "p1",
      patientStatus: "ativo",
      displayName: "Tomaz Alcântara",
    },
    patient: { fullName: "Tomaz Alcântara Cardoso", birthDate: "2021-06-01" },
    insurance: [{ insurerName: "Cassi", planName: null }],
  });
  assert.equal(s.headline, "Tomaz Alcântara Cardoso");
  assert.deepEqual(s.plan, { text: "Cassi", tone: "known" });
  assert.deepEqual(s.details[0], { label: "Idade", value: "5 anos (01/06/2021)" });
  assert.equal(s.next.kind, "open_patient");
  assert.equal(s.next.href, "/recepcao/pacientes/p1");
});

test("paciente sem convênio cadastrado é particular", () => {
  const s = buildCaseSummary({
    ...leadBase,
    conversation: { ...leadBase.conversation, kind: "patient", patientId: "p2", patientStatus: "ativo" },
    patient: { fullName: "Paulo", birthDate: null },
  });
  assert.deepEqual(s.plan, { text: "Particular", tone: "particular" });
});

test("'interessado' (cadastro incompleto) ainda é tratado como lead, sem ficha de prontuário", () => {
  const s = buildCaseSummary({
    ...leadBase,
    conversation: { ...leadBase.conversation, kind: "patient", patientId: "p3", patientStatus: "interessado" },
    patient: { fullName: "Débora", birthDate: null },
  });
  assert.notEqual(s.next.kind, "open_patient");
});

test("motivo da escalação aparece também para paciente", () => {
  const s = buildCaseSummary({
    ...leadBase,
    conversation: {
      ...leadBase.conversation,
      kind: "patient",
      patientId: "p4",
      patientStatus: "ativo",
      escalationReason: "clinico",
    },
    patient: { fullName: "Lia", birthDate: null },
  });
  assert.match(s.reason ?? "", /clínica/i);
});

test("sem nome de criança nem contato, a manchete é o telefone formatado", () => {
  const s = buildCaseSummary({
    ...leadBase,
    conversation: { ...leadBase.conversation, displayName: "+55 91 98847-0999", contactName: null },
  });
  assert.equal(s.headline, "+55 91 98847-0999");
});

test("o resumo do Chat não usa vocabulário de etapa próprio", () => {
  const src = readFileSync("lib/atendimento/case-summary-pure.ts", "utf8");
  assert.doesNotMatch(src, /pipelineStageLabel|intakeStageLabel|de 4 ·|Etapa \d\/4/);
});
