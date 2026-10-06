// tests/anamnesis-bot-pure.test.ts
//
// Validação das respostas do bot de anamnese (lib/anamnesis-bot-pure.ts):
// e-mail do responsável (com a recusa contestada uma vez) e nome completo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalAnamnesisStep,
  decideGuardianEmailStep,
  isAgendarIntent,
  isNoDocumentAnswer,
  isSkipAnswer,
  parseExitCommand,
  parseFullNameAnswer,
  parseGuardianEmailAnswer,
  parsePlanAnswer,
  parseYesNo,
} from "../lib/anamnesis-bot-pure.ts";
import { normalizeEmail, normalizeFullName } from "../lib/whatsapp-lead-pure.ts";

const parseEmail = (raw: string | null | undefined) => parseGuardianEmailAnswer(raw, normalizeEmail);
const decide = (raw: string | null | undefined, again: boolean) => decideGuardianEmailStep(raw, again, normalizeEmail);
const parseName = (raw: string | null | undefined) => parseFullNameAnswer(raw, normalizeFullName);

test("parseGuardianEmailAnswer: e-mail válido é normalizado", () => {
  assert.deepEqual(parseEmail("  Maria.Silva@Gmail.COM "), {
    kind: "email",
    email: "maria.silva@gmail.com",
  });
});

test("parseGuardianEmailAnswer: formatos inválidos", () => {
  for (const raw of ["maria", "maria@", "maria@gmail", "@gmail.com", "maria @gmail.com", "", "meu email é maria@x.com"]) {
    assert.deepEqual(parseEmail(raw), { kind: "invalid" }, raw);
  }
  assert.deepEqual(parseEmail(null), { kind: "invalid" });
  assert.deepEqual(parseEmail(undefined), { kind: "invalid" });
});

test("isSkipAnswer: reconhece recusas curtas com/sem acento e pontuação", () => {
  for (const raw of ["não tenho", "Não tenho.", "NAO", "n", "pular", "Pular!", "não possuo", "não tenho e-mail", "sem email", "prefiro não"]) {
    assert.equal(isSkipAnswer(raw), true, raw);
  }
});

test("isSkipAnswer: não confunde e-mail nem frase longa com recusa", () => {
  for (const raw of ["nao@gmail.com", "pular@x.com", "", "   ", "sim", "joao", "não tenho certeza qual e-mail usar aqui no celular do meu marido"]) {
    assert.equal(isSkipAnswer(raw), false, raw);
  }
  assert.equal(isSkipAnswer(null), false);
});

test("decideGuardianEmailStep: e-mail válido grava em qualquer rodada", () => {
  assert.deepEqual(decide("a@b.com", false), { action: "save", email: "a@b.com" });
  assert.deepEqual(decide("a@b.com", true), { action: "save", email: "a@b.com" });
});

test("decideGuardianEmailStep: primeira recusa pede de novo, segunda é aceita", () => {
  assert.deepEqual(decide("não tenho", false), { action: "reask" });
  assert.deepEqual(decide("pular", false), { action: "reask" });
  assert.deepEqual(decide("não tenho", true), { action: "accept_skip" });
});

test("decideGuardianEmailStep: texto inválido não consome a recusa", () => {
  assert.deepEqual(decide("asdf", false), { action: "invalid" });
  assert.deepEqual(decide("asdf", true), { action: "invalid" });
});

test("parseFullNameAnswer: exige pelo menos 2 palavras", () => {
  assert.equal(parseName("Maria"), null);
  assert.equal(parseName("  Maria  "), null);
  assert.equal(parseName(""), null);
  assert.equal(parseName("Maria   da  Silva"), "Maria da Silva");
  assert.equal(parseName("  João Pedro "), "João Pedro");
});

test("parseFullNameAnswer: recusa dígitos e e-mail", () => {
  assert.equal(parseName("Maria 123"), null);
  assert.equal(parseName("maria@x.com"), null);
  assert.equal(parseName(null), null);
});

// ---------------------------------------------------------------------
// Fluxo AGENDAR enxuto
// ---------------------------------------------------------------------

test("parseYesNo: só a resposta inteira conta", () => {
  for (const raw of ["Sim", "SIM!", "s", "tenho", "Sim, já tenho"]) assert.equal(parseYesNo(raw), "yes", raw);
  for (const raw of ["Não", "nao", "N", "ainda não", "Não tenho."]) assert.equal(parseYesNo(raw), "no", raw);
  // Antes: "não sei" virava NÃO (resetava o fluxo) e "assim" virava SIM.
  for (const raw of ["não sei", "assim", "simples", "nao sei se tenho", "", "ok"]) assert.equal(parseYesNo(raw), null, raw);
});

test("isAgendarIntent: palavra inteira e sem negação", () => {
  for (const raw of ["AGENDAR", "Quero agendar", "gostaria de agendar uma avaliação", "marcar avaliação", "Marcar uma consulta", "anamnese"]) {
    assert.equal(isAgendarIntent(raw), true, raw);
  }
  for (const raw of ["reagendar", "preciso reagendar a sessão", "não quero agendar", "nao vou agendar agora", "como funciona o agendamento?", "oi", ""]) {
    assert.equal(isAgendarIntent(raw), false, raw);
  }
});

test("isNoDocumentAnswer: recusa ou 'envio depois'", () => {
  for (const raw of ["não tenho", "Não", "envio depois", "Mando depois", "não tenho agora"]) assert.equal(isNoDocumentAnswer(raw), true, raw);
  for (const raw of ["?", "qual documento?", "sim", "o rg do pai serve?"]) assert.equal(isNoDocumentAnswer(raw), false, raw);
});

test("parseExitCommand: parar x atendente", () => {
  assert.equal(parseExitCommand("PARAR"), "stop");
  assert.equal(parseExitCommand("cancelar agendamento"), "stop");
  assert.equal(parseExitCommand("Atendente"), "human");
  assert.equal(parseExitCommand("quero falar com alguem"), "human");
  assert.equal(parseExitCommand("falar com atendente por favor"), "human");
  assert.equal(parseExitCommand("Maria Silva"), null);
  assert.equal(parseExitCommand("qual o telefone da recepção?"), null);
  assert.equal(parseExitCommand("a recepção abre que horas"), null);
  assert.equal(parseExitCommand("não posso parar de trabalhar nesse horário da tarde"), null);
});

test("parsePlanAnswer: particular, convênio atendido, genérico, não atendido", () => {
  const insurers = [
    { id: "1", name: "IASEP" },
    { id: "2", name: "PROASA" },
  ];
  assert.deepEqual(parsePlanAnswer("Particular", insurers), { kind: "particular" });
  assert.deepEqual(parsePlanAnswer("iasep", insurers), { kind: "insurer", id: "1", name: "IASEP" });
  assert.deepEqual(parsePlanAnswer("É pelo Proasa", insurers), { kind: "insurer", id: "2", name: "PROASA" });
  assert.deepEqual(parsePlanAnswer("Convênio", insurers), { kind: "generic_convenio" });
  assert.deepEqual(parsePlanAnswer("plano de saúde", insurers), { kind: "generic_convenio" });
  assert.deepEqual(parsePlanAnswer("Unimed", insurers), { kind: "not_served", typed: "Unimed" });
  assert.deepEqual(parsePlanAnswer("sim", insurers), { kind: "invalid" });
  assert.deepEqual(parsePlanAnswer("", insurers), { kind: "invalid" });
});

test("canonicalAnamnesisStep: etapas antigas continuam valendo", () => {
  assert.equal(canonicalAnamnesisStep("awaiting_guardian_cpf"), "legacy_identity");
  assert.equal(canonicalAnamnesisStep("awaiting_guardian_email"), "legacy_identity");
  assert.equal(canonicalAnamnesisStep("awaiting_payment_mode"), "awaiting_plan");
  assert.equal(canonicalAnamnesisStep("awaiting_has_laudo"), "awaiting_laudo");
  assert.equal(canonicalAnamnesisStep("awaiting_laudo_pdf"), "awaiting_laudo");
  assert.equal(canonicalAnamnesisStep("awaiting_has_guia"), "awaiting_carteirinha");
  assert.equal(canonicalAnamnesisStep("awaiting_carteirinha_frente"), "awaiting_carteirinha");
  assert.equal(canonicalAnamnesisStep("awaiting_documento_identidade"), "awaiting_documento_identidade");
  assert.equal(canonicalAnamnesisStep("pending_supervisor"), "pending_supervisor");
});
