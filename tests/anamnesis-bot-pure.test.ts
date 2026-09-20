// tests/anamnesis-bot-pure.test.ts
//
// Validação das respostas do bot de anamnese (lib/anamnesis-bot-pure.ts):
// e-mail do responsável (com a recusa contestada uma vez) e nome completo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideGuardianEmailStep,
  isSkipAnswer,
  parseFullNameAnswer,
  parseGuardianEmailAnswer,
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
