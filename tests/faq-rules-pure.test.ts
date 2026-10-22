// tests/faq-rules-pure.test.ts
//
// A camada de regras só pode responder pergunta simples e inequívoca; qualquer
// ambiguidade tem que devolver null (segue para a IA).
import { test } from "node:test";
import assert from "node:assert/strict";
import { expandFaqTokens, isPlaceholderAnswer, matchFaqRule, type FaqRuleData } from "../lib/faq-rules-pure.ts";

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

// Casos reais do banco (set–out/2026) que a camada de regras respondia errado.
const prodLike: FaqRuleData = {
  insurers: ["IASEP", "PROASA"],
  faq: [
    {
      question: "Como começa o atendimento?",
      answer: "O primeiro passo é a avaliação inicial (anamnese).",
      keywords: ["começar", "inicio", "primeira vez", "avaliacao", "avaliação", "anamnese", "como funciona"],
    },
    { question: "Como funciona o pacote mensal?", answer: "10 sessões por mês, pagas no início do mês.", keywords: ["pacote mensal", "mensalidade"] },
    { question: "Qual o telefone para contato?", answer: "⚠️ TODO: preencher telefone e e-mail de contato em /gestor/cadastros/faq.", keywords: ["telefone", "contato"] },
    { question: "Onde fica a clínica?", answer: "Rua Boaventura da Silva, 1573, Umarizal.", keywords: ["endereco", "endereço", "onde fica"] },
  ],
};

test("pergunta de VALOR nunca recebe a FAQ 'como começa' só porque cita 'avaliação'", () => {
  for (const msg of ["Valores de avaliação", "queria saber o valor da avaliação inicial", "quanto custa a avaliação?"]) {
    assert.equal(matchFaqRule(msg, prodLike), null, msg);
  }
  // Sem dinheiro no meio, a keyword continua valendo.
  assert.equal(matchFaqRule("Como funciona", prodLike)?.reply, "O primeiro passo é a avaliação inicial (anamnese).");
});

test("dinheiro passa quando a própria keyword cadastrada cobre o termo", () => {
  assert.equal(matchFaqRule("a mensalidade é adiantada?", prodLike)?.reply, "10 sessões por mês, pagas no início do mês.");
  // "quanto" não está coberto por nenhuma keyword → IA.
  assert.equal(matchFaqRule("quanto é a mensalidade?", prodLike), null);
});

test("resposta placeholder (⚠️ TODO) nunca sai por regra", () => {
  assert.equal(matchFaqRule("Qual o telefone de vocês?", prodLike), null);
  assert.equal(isPlaceholderAnswer("⚠️ TODO: preencher"), true);
  assert.equal(isPlaceholderAnswer("TODO preencher"), true);
  assert.equal(isPlaceholderAnswer("Rua Boaventura da Silva, 1573"), false);
});

test("'pelo plano X' / 'plano X' confirma o convênio citado em vez da FAQ genérica", () => {
  for (const msg of ["Estou a procura pelo plano IASEP", "Plano IASEP", "convênio PROASA"]) {
    const r = matchFaqRule(msg, prodLike);
    assert.equal(r?.intent, "faq_regra_convenio", msg);
  }
  // Posse ("somos do Iasep") continua indo para a IA, que registra o plano da família.
  assert.equal(matchFaqRule("Somos do Iasep", prodLike), null);
  assert.equal(matchFaqRule("Qual o convênio Bradesco?", prodLike), null);
});

test("só a palavra 'planos' / 'planos de saúde' / 'convênios' lista os convênios dinamicamente", () => {
  for (const msg of ["Planos de saúde", "planos", "Convênios", "os convenios atendidos"]) {
    assert.equal(matchFaqRule(msg, prodLike)?.intent, "faq_regra_lista_convenios", msg);
  }
});

test("{{convenios}} é trocado pela lista cadastrada e some sem convênios", () => {
  const tpl = "Atendemos *{{convenios}}*; estamos credenciando outros planos. Reembolso por nota fiscal.";
  assert.equal(expandFaqTokens(tpl, ["IASEP", "PROASA"]), "Atendemos *IASEP e PROASA*; estamos credenciando outros planos. Reembolso por nota fiscal.");
  assert.equal(expandFaqTokens(tpl, ["IASEP"]), "Atendemos *IASEP*; estamos credenciando outros planos. Reembolso por nota fiscal.");
  assert.equal(expandFaqTokens(tpl, ["A", "B", "C"]), "Atendemos *A, B e C*; estamos credenciando outros planos. Reembolso por nota fiscal.");
  assert.equal(expandFaqTokens(tpl, []), "estamos credenciando outros planos. Reembolso por nota fiscal.");
  assert.equal(expandFaqTokens("Sem token", ["IASEP"]), "Sem token");
});
