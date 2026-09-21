// tests/greeting-pure.test.ts
//
// A saudação fixa (sem IA) só pode pegar mensagem que é APENAS saudação —
// pergunta junto tem que seguir para o agente de FAQ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_GREETING_REPLY, isPureGreeting } from "../lib/greeting-pure.ts";

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
