// tests/job-inquiry-pure.test.ts
//
// "Vaga" é a mesma palavra para emprego e para horário livre na agenda. Esta
// trava (lib/job-inquiry-pure.ts) é o que impede a resposta "não recebemos
// currículos" — que DESLIGA o bot da conversa — de cair em cima de uma
// família perguntando por horário de avaliação.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasExplicitJobSignal, hasStrongJobSignal, JOB_AMBIGUOUS_REPLY, JOB_INQUIRY_REPLY } from "../lib/job-inquiry-pure.ts";

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

test("a resposta fixa aponta para a página de candidatura direta e dá o e-mail como alternativa", () => {
  assert.match(JOB_INQUIRY_REPLY, /https:\/\/institutofacaamigos\.com\.br\/trabalhe-conosco/);
  assert.match(JOB_INQUIRY_REPLY, /Venha fazer parte do nosso time/);
  assert.match(JOB_INQUIRY_REPLY, /institutofacaamigos@gmail\.com/);
  assert.doesNotMatch(JOB_INQUIRY_REPLY, /www\./, "www. redireciona (308) — o link direto evita um salto");
});

// Mensagens reais de 16–21/10/2026 que caíam em "Não consegui responder agora":
// o modelo dizia "emprego", o regex não conhecia as funções do anúncio e a
// resposta era descartada.
test("funções dos anúncios reais (atendente, fisioterapeuta, educação física) são candidatura explícita", () => {
  for (const msg of [
    "Vaga de fisioterapeuta",
    "Gostaria de informações sobre a vaga de atendente?",
    "Sou fisioterapeuta e gostaria de me candidatar para vaga",
    "Ainda está disponível a vaga para atendente?",
    "Estão precisando de professor de educação física",
    "Como faço para me candidatar para a vaga de fisioterapeuta?",
    "vaga p atendente ETA disponível?",
    "Gostaria de saber se a clínica está com vagas abertas para profissionais da saude?",
    "Eu vim pela proposta de contratação para fisioterapeuta.",
    "Olá! Vim pelo site e gostaria de saber sobre a vaga de atendente/vendedora",
  ]) {
    assert.equal(hasExplicitJobSignal(msg), true, msg);
  }
});

test("sinal forte: função do anúncio junto de 'vaga' responde sem IA", () => {
  for (const msg of [
    "Vaga de fisioterapeuta",
    "Ainda está disponível a vaga para atendente?",
    "Bom dia, gostaria de me candidatar a vaga para atendente!",
    "vaga p atendente ETA disponível?",
    "Gostaria de saber se a clínica está com vagas abertas para profissionais da saude?",
  ]) {
    assert.equal(hasStrongJobSignal(msg), true, msg);
  }
});

test("ambíguas continuam sem marca explícita (viram pergunta de desambiguação, nunca fallback)", () => {
  for (const msg of ["Vaga está disponível?", "Em busca de uma oportunidade", "Sobre a vaga?", "Tem vaga para A.T"]) {
    assert.equal(hasExplicitJobSignal(msg), false, msg);
    assert.equal(hasStrongJobSignal(msg), false, msg);
  }
  assert.match(JOB_AMBIGUOUS_REPLY, /vaga de trabalho/);
  assert.match(JOB_AMBIGUOUS_REPLY, /atendimento/);
});

test("família que cita uma profissão sem 'vaga' nunca cai em emprego", () => {
  for (const msg of [
    "A fisioterapeuta indicou integração sensorial, vocês têm?",
    "Quero falar com uma atendente",
    "A professora da escola pediu avaliação",
    "Vocês têm vaga para terapia ocupacional pelo IASEP?",
    "tem vaga para fono?",
    "Quero contratar uma fonoaudióloga para meu filho",
  ]) {
    assert.equal(hasStrongJobSignal(msg), false, msg);
  }
});
