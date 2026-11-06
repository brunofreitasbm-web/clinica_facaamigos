// tests/price-policy-pure.test.ts
//
// Regra de preço do bot da clínica: nunca valor em texto; particular recebe a
// arte + frase fixa e transborda; convênio só transborda; tipo desconhecido
// pergunta; arte já enviada não é reenviada.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRICE_ART_ALREADY_SENT_REPLY,
  PRICE_ART_CAPTION,
  PRICE_ART_URL,
  PRICE_ASK_TYPE_INTENT,
  PRICE_ASK_TYPE_QUESTION,
  PRICE_CONVENIO_REPLY,
  containsMoney,
  decidePriceStep,
  detectAttendanceType,
  inferKnownAttendanceType,
  isPriceQuestion,
} from "../lib/price-policy-pure.ts";

const step = (body: string, extra: Partial<Parameters<typeof decidePriceStep>[0]> = {}) =>
  decidePriceStep({ body, awaitingType: false, knownType: null, artSent: false, ...extra }).kind;

test("textos fixos: URL da arte, frase exata e nenhum valor", () => {
  assert.equal(PRICE_ART_URL, "https://institutofacaamigos.com.br/chatbot-clinica/planos-particular.png");
  assert.equal(
    PRICE_ART_CAPTION,
    "Estes são os pacotes mensais. A quantidade e a distribuição das terapias dependem de cada criança. Vou te passar para a equipe, que monta a melhor opção com você.",
  );
  assert.equal(PRICE_ASK_TYPE_QUESTION, "É por convênio ou particular?");
  for (const t of [PRICE_ART_CAPTION, PRICE_CONVENIO_REPLY, PRICE_ART_ALREADY_SENT_REPLY, PRICE_ASK_TYPE_QUESTION]) assert.equal(containsMoney(t), false, t);
});

test("isPriceQuestion: pacote, plano mensal, valor, preço, quanto custa", () => {
  for (const m of ["Quanto custa?", "qual o valor da sessão", "Quais os preços?", "Tem pacote mensal?", "me passa os planos mensais", "quanto é a consulta", "tabela de valores", "Quanto fica 8 sessões?"]) {
    assert.equal(isPriceQuestion(m), true, m);
  }
});

test("isPriceQuestion: não confunde com duração, plano de saúde ou saudação", () => {
  for (const m of ["Quanto tempo dura a sessão?", "vocês atendem plano de saúde?", "Bom dia", "quantos anos atendem?", "qual o endereço"]) {
    assert.equal(isPriceQuestion(m), false, m);
  }
});

test("detectAttendanceType", () => {
  assert.equal(detectAttendanceType("atendo pelo IASEP"), "convenio");
  assert.equal(detectAttendanceType("Convênio"), "convenio");
  assert.equal(detectAttendanceType("somos PROASA"), "convenio");
  assert.equal(detectAttendanceType("Particular"), "particular");
  assert.equal(detectAttendanceType("sem convênio, é particular mesmo"), "particular");
  assert.equal(detectAttendanceType("não tenho plano"), "particular");
  assert.equal(detectAttendanceType("convênio ou particular?"), null);
  assert.equal(detectAttendanceType("quanto custa"), null);
});

test("tipo desconhecido: pergunta antes de enviar qualquer coisa", () => {
  assert.equal(step("Quanto custa?"), "ask_type");
  assert.equal(step("quais os pacotes?"), "ask_type");
});

test("resposta à pergunta de tipo: particular envia a arte; convênio transborda", () => {
  assert.equal(step("particular", { awaitingType: true }), "send_art");
  assert.equal(step("Convênio IASEP", { awaitingType: true }), "convenio");
  assert.equal(step("é PROASA", { awaitingType: true }), "convenio");
});

test("sem ter perguntado o tipo, 'particular' solto não dispara arte", () => {
  assert.equal(step("particular"), "none");
  assert.equal(step("oi, tudo bem?"), "none");
});

test("particular dito na própria pergunta: arte direto", () => {
  assert.equal(step("Quanto custa no particular?"), "send_art");
  assert.equal(step("valor dos pacotes particular"), "send_art");
});

test("particular já conhecido da conversa (menu ou fala anterior): arte direto", () => {
  assert.equal(step("quais os valores?", { knownType: "particular" }), "send_art");
});

test("convênio: nunca informa preço, só transborda", () => {
  assert.equal(step("quanto custa pelo IASEP?"), "convenio");
  assert.equal(step("qual o valor?", { knownType: "convenio" }), "convenio");
  assert.equal(step("valor da sessão pelo convênio", { artSent: true }), "convenio");
});

test("arte já enviada: não reenvia, só transborda", () => {
  assert.equal(step("quanto custa? particular", { artSent: true }), "art_already_sent");
  assert.equal(step("e os valores?", { knownType: "particular", artSent: true }), "art_already_sent");
  assert.equal(step("particular", { awaitingType: true, artSent: true }), "art_already_sent");
});

test("inferKnownAttendanceType: vale o mais recente; menu escolhido conta", () => {
  assert.equal(
    inferKnownAttendanceType([
      { sender: "user", body: "particular", intent: null },
      { sender: "bot", body: "É por convênio ou particular?", intent: PRICE_ASK_TYPE_INTENT },
      { sender: "user", body: "quanto custa?", intent: null },
    ]),
    "particular",
  );
  assert.equal(
    inferKnownAttendanceType([
      { sender: "user", body: "tenho IASEP", intent: null },
      { sender: "user", body: "particular", intent: null },
    ]),
    "convenio",
  );
  assert.equal(inferKnownAttendanceType([{ sender: "bot", body: null, intent: "menu_particular" }]), "particular");
  assert.equal(inferKnownAttendanceType([{ sender: "bot", body: null, intent: "menu_plano" }]), "convenio");
  assert.equal(inferKnownAttendanceType([{ sender: "user", body: "oi", intent: null }, { sender: "bot", body: "menu", intent: "menu_inicial" }]), null);
});

test("containsMoney: pega R$ e 'reais', ignora números soltos", () => {
  for (const t of ["R$ 190", "r$190,00", "custa 1.400 reais", "são 2500 reais", "R $ 720"]) assert.equal(containsMoney(t), true, t);
  for (const t of ["8 sessões por mês", "40 minutos", "até 3x no cartão", "Estes são os pacotes mensais."]) assert.equal(containsMoney(t), false, t);
});
