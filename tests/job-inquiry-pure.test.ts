// tests/job-inquiry-pure.test.ts
//
// "Vaga" é a mesma palavra para emprego e para horário livre na agenda. Esta
// trava (lib/job-inquiry-pure.ts) é o que impede a resposta "não recebemos
// currículos" — que DESLIGA o bot da conversa — de cair em cima de uma
// família perguntando por horário de avaliação.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasExplicitJobSignal, hasStrongJobSignal, JOB_INQUIRY_REPLY } from "../lib/job-inquiry-pure.ts";

test("candidatura explícita é reconhecida", () => {
  for (const msg of [
    "Posso mandar meu currículo?",
    "Boa tarde, vocês estão contratando psicóloga?",
    "Tem vaga de emprego aí?",
    "tem vaga pra estagio de psicologia?",
    "Sou fonoaudióloga recém-formada, tem oportunidade de trabalho aí?",
    "Como faço para trabalhar com vocês?",
    "quero enviar meu CV",
    "onde fica o trabalhe conosco?",
    "Gostaria de participar do processo seletivo",
  ]) {
    assert.equal(hasExplicitJobSignal(msg), true, msg);
  }
});

test("vaga de agendamento NUNCA é lida como emprego", () => {
  for (const msg of [
    "Vocês têm vaga para avaliação?",
    "tem vaga essa semana?",
    "Abriu vaga na terça de manhã?",
    "estão com vaga para fono pelo plano?",
    "Quando abre vaga para ABA?",
    "Vocês têm vaga?",
    "meu filho precisa de terapia ocupacional, tem horário?",
    "qual o valor da avaliação?",
  ]) {
    assert.equal(hasExplicitJobSignal(msg), false, msg);
  }
});

test("acentuação e caixa não mudam a decisão", () => {
  assert.equal(hasExplicitJobSignal("CURRÍCULO"), true);
  assert.equal(hasExplicitJobSignal("curriculo"), true);
});

test("sinal forte: candidaturas reais do WhatsApp são reconhecidas", () => {
  for (const msg of [
    "Gostaria de saber também se estão aceitando currículo para estágio em psicologia?",
    "Me chamo Marcela, sou fisioterapeuta. E gostaria de fazer parte da equipe faça amigos, estão aceitando currículo?",
    "Irei enviar meu currículo por aqui, caso vcs estejam precisando de profissional",
    "Vocês estão contratando?",
    "Tem vaga de emprego aí?",
    "onde fica o Trabalhe Conosco?",
    "Gostaria de participar do processo seletivo",
    "quero enviar meu CV",
  ]) {
    assert.equal(hasStrongJobSignal(msg), true, msg);
  }
});

test("sinal forte: frase de família NUNCA silencia o bot", () => {
  for (const msg of [
    "Quero contratar as sessões de fono para meu filho",
    "Gostaria de trabalhar a fala do meu filho",
    "Queremos trabalhar com vocês o desenvolvimento dele",
    "A estagiária vai atender meu filho?",
    "Qual o currículo da fonoaudióloga?",
    "Tem vaga para terapeuta ocupacional?",
    "Vocês têm vaga para avaliação?",
    "tem vaga essa semana?",
    "Oi, vocês atendem Unimed?",
  ]) {
    assert.equal(hasStrongJobSignal(msg), false, msg);
  }
});

test("a resposta fixa aponta para o site e cita os dois rótulos", () => {
  assert.match(JOB_INQUIRY_REPLY, /www\.institutofacaamigos\.com\.br/);
  assert.match(JOB_INQUIRY_REPLY, /Trabalhe Conosco/);
  assert.match(JOB_INQUIRY_REPLY, /Venha fazer parte do nosso time/);
});
