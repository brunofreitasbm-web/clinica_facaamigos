// tests/welcome-menu-pure.test.ts
//
// Menu inicial do WhatsApp: leitura das respostas (toque, número, título), navegação
// "voltar ao menu anterior" e regras de texto (emojis do padrão, sem arco-íris,
// limites da lista interativa).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_EMOJIS,
  COMMERCIAL_THERAPIES,
  CURRICULO_REPLY,
  DUVIDAS_PROMPT,
  HUMANO_HANDOFF,
  LIST_DESCRIPTION_MAX,
  LIST_ITEMS_MAX,
  LIST_TITLE_MAX,
  MENU_INTENT,
  PARTICULAR_AGENDAR_COLETA,
  PARTICULAR_COLETA_INTENT,
  PARTICULAR_COMO_FUNCIONA,
  PARTICULAR_COMO_FUNCIONA_INTENT,
  PARTICULAR_MENU_BODY,
  PARTICULAR_MENU_INTENT,
  PARTICULAR_MENU_OPTIONS,
  PARTICULAR_MENU_TEXT,
  PARTICULAR_PLANS,
  PARTICULAR_VALORES_INTENT,
  WELCOME_MENU_BODY,
  WELCOME_MENU_OPTIONS,
  WELCOME_MENU_TEXT,
  buildConhecerMessage,
  buildParticularPricesCaption,
  buildParticularPricesText,
  buildPlanoIntro,
  buildTherapiesMessage,
  lowestPricePerSession,
  parseNavReply,
  parseParticularActionReply,
  parseParticularMenuReply,
  parseWelcomeMenuReply,
  previousMenuFor,
} from "../lib/welcome-menu-pure.ts";

test("menu principal: toque, número e título levam à mesma opção", () => {
  assert.equal(parseWelcomeMenuReply({ listId: "menu_curriculo", body: "Currículos" }), "menu_curriculo");
  assert.equal(parseWelcomeMenuReply({ body: "6" }), "menu_curriculo");
  assert.equal(parseWelcomeMenuReply({ body: "Currículos" }), "menu_curriculo");
  assert.equal(parseWelcomeMenuReply({ body: "quero conhecer a clinica" }), "menu_conhecer");
  assert.equal(parseWelcomeMenuReply({ body: "1" }), "menu_particular");
  assert.equal(parseWelcomeMenuReply({ body: "7" }), "menu_outros");
});

test("menu principal: texto livre, número fora da lista e ID de outra lista não são escolha", () => {
  assert.equal(parseWelcomeMenuReply({ body: "vocês atendem IASEP?" }), null);
  assert.equal(parseWelcomeMenuReply({ body: "8" }), null);
  assert.equal(parseWelcomeMenuReply({ body: "0" }), null);
  assert.equal(parseWelcomeMenuReply({ listId: "part_valores" }), null);
  assert.equal(parseWelcomeMenuReply({ body: "" }), null);
});

test("submenu Particular: opções, voltar e números", () => {
  assert.equal(parseParticularMenuReply({ body: "2" }), "part_valores");
  assert.equal(parseParticularMenuReply({ body: "Agendar avaliação" }), "part_agendar");
  assert.equal(parseParticularMenuReply({ listId: "part_humano" }), "part_humano");
  // O último item é "voltar ao menu", inclusive no texto numerado de reserva.
  assert.equal(parseParticularMenuReply({ body: "5" }), "nav_back");
  assert.equal(parseParticularMenuReply({ listId: "nav_back" }), "nav_back");
  assert.equal(parseParticularMenuReply({ body: "9" }), null);
});

test("telas Como funciona e Valores: 1 agenda, 2 volta", () => {
  assert.equal(parseParticularActionReply({ body: "1" }), "part_agendar");
  assert.equal(parseParticularActionReply({ body: "2" }), "nav_back");
  assert.equal(parseParticularActionReply({ buttonPayload: "part_agendar" }), "part_agendar");
  assert.equal(parseParticularActionReply({ buttonPayload: "nav_back" }), "nav_back");
  assert.equal(parseParticularActionReply({ body: "quanto custa?" }), null);
});

test("VOLTAR e MENU só valem com a mensagem inteira", () => {
  for (const msg of ["voltar", "Voltar", "VOLTAR!", "0", "menu anterior", "Voltar ao menu", "↩ Voltar ao menu"]) {
    assert.equal(parseNavReply({ body: msg }), "back", msg);
  }
  for (const msg of ["menu", "MENU", "Menu principal"]) assert.equal(parseNavReply({ body: msg }), "menu", msg);
  assert.equal(parseNavReply({ buttonPayload: "nav_back" }), "back");
  assert.equal(parseNavReply({ listId: "nav_back" }), "back");
  for (const msg of ["quero voltar amanhã", "qual o menu de valores?", "oi", "10"]) assert.equal(parseNavReply({ body: msg }), null, msg);
});

test("menu anterior vem do intent da última mensagem do bot", () => {
  assert.equal(previousMenuFor(PARTICULAR_COMO_FUNCIONA_INTENT), "particular");
  assert.equal(previousMenuFor(PARTICULAR_VALORES_INTENT), "particular");
  assert.equal(previousMenuFor(PARTICULAR_COLETA_INTENT), "particular");
  assert.equal(previousMenuFor(PARTICULAR_MENU_INTENT), "main");
  assert.equal(previousMenuFor(MENU_INTENT), "main");
  assert.equal(previousMenuFor("menu_terapias"), "main");
  assert.equal(previousMenuFor("faq_planos"), "main");
  assert.equal(previousMenuFor(null), "main");
});

test("listas respeitam os limites do WhatsApp", () => {
  for (const options of [WELCOME_MENU_OPTIONS, PARTICULAR_MENU_OPTIONS]) {
    assert.ok(options.length <= LIST_ITEMS_MAX);
    const ids = new Set(options.map((o) => o.id));
    assert.equal(ids.size, options.length, "ids duplicados");
    for (const o of options) {
      assert.ok(o.title.length <= LIST_TITLE_MAX, `título longo: ${o.title}`);
      assert.ok((o.description ?? "").length <= LIST_DESCRIPTION_MAX, `descrição longa: ${o.title}`);
    }
  }
  assert.equal(WELCOME_MENU_OPTIONS.length, 7);
  // Sem playground: decisão do dono (3 de 304 conversas citam).
  assert.ok(!WELCOME_MENU_OPTIONS.some((o) => /playground|bosque|parque/i.test(o.title)));
});

test("todo submenu tem a opção de voltar ao menu anterior", () => {
  assert.ok(PARTICULAR_MENU_OPTIONS.some((o) => o.id === "nav_back"));
  assert.match(PARTICULAR_MENU_TEXT, /Voltar ao menu/);
  for (const screen of [buildTherapiesMessage(), DUVIDAS_PROMPT, CURRICULO_REPLY + "\n\n" + DUVIDAS_PROMPT, buildConhecerMessage({})]) {
    assert.match(screen, /VOLTAR/, screen.slice(0, 40));
  }
  for (const screen of [PARTICULAR_COMO_FUNCIONA, buildParticularPricesText(), buildParticularPricesCaption(), PARTICULAR_AGENDAR_COLETA]) {
    assert.match(screen, /\*2\* para voltar|\*VOLTAR\*/, screen.slice(0, 40));
  }
});

test("mensagens fixas usam emojis do padrão FaçaAmigos e nenhum arco-íris", () => {
  const fixed = [
    WELCOME_MENU_BODY,
    WELCOME_MENU_TEXT,
    PARTICULAR_MENU_BODY,
    PARTICULAR_MENU_TEXT,
    CURRICULO_REPLY,
    DUVIDAS_PROMPT,
    HUMANO_HANDOFF,
    PARTICULAR_COMO_FUNCIONA,
    PARTICULAR_AGENDAR_COLETA,
    buildTherapiesMessage(),
    buildParticularPricesText(),
    buildParticularPricesCaption(),
    buildPlanoIntro(["IASEP", "PROASA"]),
    buildConhecerMessage({ address: "Rua X, 1", mapsUrl: "https://maps", hours: "Seg a Sex" }),
  ];
  for (const text of fixed) {
    assert.ok(BRAND_EMOJIS.some((e) => text.includes(e)), `sem emoji do padrão: ${text.slice(0, 50)}`);
    assert.ok(!text.includes("🌈"), `arco-íris: ${text.slice(0, 50)}`);
  }
  assert.match(WELCOME_MENU_TEXT, /FaçaAmigos - Centro de Terapia Comportamental/);
});

test("currículo: nome do formulário é 'Faça parte do nosso time' e não se recebe por WhatsApp", () => {
  assert.match(CURRICULO_REPLY, /Faça parte do nosso time/);
  assert.doesNotMatch(CURRICULO_REPLY, /Venha fazer parte/);
  assert.match(CURRICULO_REPLY, /não recebemos currículos/i);
});

test("terapias: 14 nomes comerciais, sem duplicata, dentro do limite do WhatsApp", () => {
  assert.equal(COMMERCIAL_THERAPIES.length, 14);
  assert.equal(new Set(COMMERCIAL_THERAPIES.map((t) => t.name)).size, 14);
  const message = buildTherapiesMessage();
  for (const t of COMMERCIAL_THERAPIES) assert.ok(message.includes(`*${t.name}*`), t.name);
  assert.ok(message.length < 4096);
});

test("planos particulares: valores do dono e menor valor por sessão", () => {
  const byName = Object.fromEntries(PARTICULAR_PLANS.map((p) => [p.name, p]));
  assert.equal(byName["Laço"].price, 1400);
  assert.equal(byName["Voo Livre"].sessions, 24);
  assert.equal(Math.round(lowestPricePerSession(PARTICULAR_PLANS) * 100) / 100, 151.67);

  const text = buildParticularPricesText();
  for (const price of ["R$ 190", "R$ 720", "R$ 1.400", "R$ 1.990", "R$ 2.580", "R$ 3.120", "R$ 3.640", "R$ 2.500"]) {
    assert.ok(text.includes(price), price);
  }
  // Regras confirmadas: avaliação conta como 1 sessão, ABA conta 3, parcelamento em 3x.
  assert.match(text, /avaliação inicial conta como 1 sessão/);
  assert.match(text, /Treino ABA[^.]*3 sessões/);
  assert.match(text, /3x no cartão/);
  assert.match(buildParticularPricesCaption(), /R\$ 151,67/);
});

test("plano de saúde: intro lista os convênios e pergunta o nome do responsável", () => {
  const text = buildPlanoIntro(["IASEP", "PROASA"]);
  assert.match(text, /\*IASEP\*, \*PROASA\*/);
  assert.match(text, /nome completo/);
  assert.match(text, /VOLTAR/);
  assert.match(buildPlanoIntro([]), /nossos convênios parceiros/);
});
