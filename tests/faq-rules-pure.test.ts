// tests/faq-rules-pure.test.ts
//
// A camada de regras só pode responder pergunta simples e inequívoca; qualquer
// ambiguidade tem que devolver null (segue para a IA).
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFaqRule, type FaqRuleData } from "../lib/faq-rules-pure.ts";

const data: FaqRuleData = {
  insurers: ["Unimed", "Amazônia Saúde", "PROASA"],
  faq: [
    { question: "Onde fica a clínica?", answer: "Ficamos no Parque Shopping, Belém/PA.", keywords: ["endereço", "onde fica", "localização"] },
    { question: "Tem estacionamento?", answer: "Sim, o shopping tem estacionamento.", keywords: ["estacionamento"] },
  ],
};

test("pergunta simples de convênio cadastrado é respondida por regra", () => {
  for (const msg of ["Vocês atendem Unimed?", "aceitam proasa?", "Vocês atendem Amazônia Saúde?"]) {
    const r = matchFaqRule(msg, data);
    assert.equal(r?.intent, "faq_regra_convenio", msg);
    assert.match(r!.reply, /AGENDAR/);
  }
});

test("lista de convênios", () => {
  const r = matchFaqRule("Quais planos vocês atendem?", data);
  assert.equal(r?.intent, "faq_regra_lista_convenios");
  assert.match(r!.reply, /Unimed/);
  assert.match(r!.reply, /PROASA/);
});

test("palavra-chave do clinic_faq responde com o texto do gestor", () => {
  const r = matchFaqRule("qual o endereço de vocês?", data);
  assert.equal(r?.intent, "faq_regra_faq");
  assert.equal(r?.reply, "Ficamos no Parque Shopping, Belém/PA.");
});

test("ambiguidade, dinheiro, terapia, agendamento, posse de plano e humano vão para a IA", () => {
  for (const msg of [
    "Vocês atendem Unimed fono?", // terapia específica
    "Unimed reembolsa?", // dinheiro
    "Vocês atendem Unimed e PROASA?", // dois convênios
    "meu filho tem Unimed, vocês atendem?", // IA registra o convênio da família
    "Vocês não atendem Unimed?", // negação
    "Vocês atendem Unimed? Quero agendar", // agendamento
    "Vocês atendem Unimed terça?", // dia concreto
    "quero falar com um atendente sobre o endereço", // humano
    "Onde fica? E tem vaga amanhã?", // pergunta composta
    "meu filho tem estacionamento no laudo?", // clínico/posse
    "Qual o convênio Bradesco?", // convênio não cadastrado
    "Vocês atendem convênio Hapvida?", // não cadastrado: IA decide/escala
    "onde fica e tem estacionamento", // duas entradas do FAQ casam
    "vocês dão diagnóstico de autismo? onde fica?", // clínico
    "",
  ]) {
    assert.equal(matchFaqRule(msg, data), null, msg);
  }
});

test("mensagem longa nunca casa por regra", () => {
  assert.equal(
    matchFaqRule("boa tarde queria saber se vocês atendem Unimed aqui na cidade de belém porque estou pensando em mudar", data),
    null,
  );
});
