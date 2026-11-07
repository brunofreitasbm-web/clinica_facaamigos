// tests/human-request-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectHumanRequest } from "../lib/human-request-pure.ts";

test("pedidos claros de falar com uma pessoa são reconhecidos", () => {
  for (const msg of [
    "Queria falar com alguém sobre a guia da minha filha",
    "Quero falar com um atendente",
    "gostaria de conversar com uma pessoa",
    "Bom dia, preciso falar com a recepção",
    "falar com atendente por favor",
    "Me passa para um atendente?",
    "pode me transferir pra uma pessoa",
    "Não quero falar com robô",
    "chega de robô, quero uma pessoa de verdade",
    "alguém pode me ligar?",
    "me liga por favor",
    "tem como falar com a secretaria?",
    "Atendente, por favor!",
  ]) {
    assert.equal(detectHumanRequest(msg), true, msg);
  }
});

test("citar atendimento/atendente sem pedir não escala", () => {
  for (const msg of [
    "O atendente me ajudou muito, obrigada!",
    "Fui atendida ontem e foi ótimo",
    "Qual o telefone da recepção?",
    "Maria Pessoa Silva",
    "a equipe de vocês atende aos sábados?",
    "quero agendar uma avaliação",
    "meu filho precisa de fonoaudiologia",
    "Obrigada pela atenção",
    "",
  ]) {
    assert.equal(detectHumanRequest(msg), false, msg);
  }
  assert.equal(detectHumanRequest(null), false);
  assert.equal(detectHumanRequest(undefined), false);
});

test("acentos e pontuação não atrapalham", () => {
  assert.equal(detectHumanRequest("QUERIA FALAR COM ALGUÉM!!!"), true);
  assert.equal(detectHumanRequest("preciso... falar, com a equipe"), true);
});
