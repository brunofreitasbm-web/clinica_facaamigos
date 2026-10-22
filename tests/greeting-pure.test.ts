// tests/greeting-pure.test.ts
//
// A saudação fixa (sem IA) só pode pegar mensagem que é APENAS saudação —
// pergunta junto tem que seguir para o agente de FAQ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_GREETING_REPLY, SITE_PREFILL_REPLIES, detectSitePrefill, isPureGreeting } from "../lib/greeting-pure.ts";

test("saudações puras e texto pré-preenchido do site são reconhecidos", () => {
  for (const msg of [
    "Olá",
    "Olá!",
    "Oi",
    "oii",
    "Bom dia",
    "Boa tarde",
    "Boa noite!",
    "Oi, muito bom dia",
    "Oi, tudo bem?",
    "tudo bem",
    "Olá, boa tarde",
    "Olá! Gostaria de informações sobre o *FaçaAmigos - Centro de Terapia Comportamental*🌈",
    "Olá! Gostaria de informações sobre o *FaçaAmigos - Centro de Terapia Comportamental*�",
    "Olá! Vim pelo site e gostaria de informações sobre o FaçaAmigos - Centro de Terapia Comportamental.",
  ]) {
    assert.equal(isPureGreeting(msg), true, msg);
  }
});

test("saudação com pergunta ou conteúdo NÃO é saudação pura", () => {
  for (const msg of [
    "Oi, vocês atendem Unimed?",
    "Bom dia, gostaria de agendar uma avaliação",
    "Olá! Gostaria de informações sobre o valor da avaliação",
    "Boa tarde, tudo bem, ele tem sete anos",
    "Como funciona essa avaliação somos do iasep",
    "Eu tenho Hapvida",
    "AGENDAR",
    "",
    "   ",
  ]) {
    assert.equal(isPureGreeting(msg), false, msg);
  }
});

test("a resposta fixa cita a marca e o gatilho AGENDAR", () => {
  assert.match(INITIAL_GREETING_REPLY, /FaçaAmigos - Centro de Terapia Comportamental/);
  assert.match(INITIAL_GREETING_REPLY, /\*AGENDAR\*/);
});

// Os outros botões do site (lista de espera, mapeamento, menor de 4 anos)
// chegam com texto pronto e recebem resposta fixa própria — antes caíam no
// Gemini ou no fallback de boas-vindas.
test("botões do site são identificados pelo texto pré-preenchido", () => {
  assert.equal(
    detectSitePrefill("Olá! Quero entrar na lista de espera da Clínica FaçaAmigos - Centro de Terapia Comportamental (vim pelo site)."),
    "lista_espera",
  );
  assert.equal(detectSitePrefill("Acabei de fazer o Mapeamento Comportamental do(a) Arthur. Gostaria de conversar."), "mapeamento");
  assert.equal(
    detectSitePrefill("Acabei de fazer o Mapeamento Comportamental do(a) Ágatha e gostaria de entrar na lista de espera da Clínica."),
    "mapeamento",
  );
  assert.equal(detectSitePrefill("Oi! Tenho uma dúvida sobre o Mapeamento Comportamental."), "mapeamento");
  assert.equal(
    detectSitePrefill("Oi! Minha criança (Arthur) tem menos de 4 anos e eu gostaria de conversar sobre o desenvolvimento dela."),
    "menor_4",
  );
  assert.equal(detectSitePrefill("Olá! Vim pelo site e gostaria de informações sobre o FaçaAmigos - Centro de Terapia Comportamental."), "info");
  for (const msg of ["Oi", "Vcs aceitam iasep?", "Gostaria de entrar para lista de espera atendimento IASEP", ""]) {
    assert.equal(detectSitePrefill(msg), null, msg);
  }
});

test("respostas dos botões não prometem agenda nem mandam responder AGENDAR", () => {
  for (const reply of Object.values(SITE_PREFILL_REPLIES)) {
    assert.doesNotMatch(reply, /AGENDAR/);
    assert.doesNotMatch(reply, /vaga/i);
    assert.doesNotMatch(reply, /institutofacaamigos/);
  }
  assert.match(SITE_PREFILL_REPLIES.lista_espera, /lista de espera/);
  assert.match(SITE_PREFILL_REPLIES.mapeamento, /não é um diagnóstico/);
});
