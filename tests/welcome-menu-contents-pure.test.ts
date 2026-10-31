// tests/welcome-menu-contents-pure.test.ts
//
// Definições dos Contents da Twilio do menu: os ids que a Twilio devolve ao webhook precisam
// ser os que os parsers do bot reconhecem, e os limites da lista do WhatsApp valem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WELCOME_CONTENTS, buildListItems, contentCreatePayload } from "../lib/welcome-menu-contents-pure.ts";
import {
  LIST_TITLE_MAX,
  NAV_BACK_ID,
  PARTICULAR_MENU_OPTIONS,
  PART_AGENDAR_ID,
  WELCOME_MENU_OPTIONS,
  parseNavReply,
  parseParticularActionReply,
  parseParticularMenuReply,
  parseWelcomeMenuReply,
} from "../lib/welcome-menu-pure.ts";

const byKey = (key: string) => {
  const def = WELCOME_CONTENTS.find((c) => c.key === key);
  assert.ok(def, key);
  return def;
};

test("são 4 conteúdos, com nomes, variáveis de ambiente e colunas únicos", () => {
  assert.equal(WELCOME_CONTENTS.length, 4);
  for (const field of ["friendlyName", "envVar", "column", "key"] as const) {
    assert.equal(new Set(WELCOME_CONTENTS.map((c) => c[field])).size, 4, field);
  }
  for (const c of WELCOME_CONTENTS) assert.match(c.friendlyName, /^fa_clinica_/);
});

test("listas: itens com os ids do bot, dentro dos limites do WhatsApp", () => {
  const main = byKey("main").types["twilio/list-picker"] as { items: { item: string; id: string }[]; button: string };
  assert.deepEqual(
    main.items.map((i) => i.id),
    WELCOME_MENU_OPTIONS.map((o) => o.id),
  );
  for (const item of main.items) {
    assert.ok(item.item.length <= LIST_TITLE_MAX, item.item);
    // Tocar no item chega ao webhook como ListId: o parser tem que aceitá-lo.
    assert.equal(parseWelcomeMenuReply({ listId: item.id, body: item.item }), item.id);
  }
  assert.ok(main.button.length <= 20, "botão da lista: até 20 caracteres");

  const particular = byKey("particular").types["twilio/list-picker"] as { items: { item: string; id: string }[] };
  assert.deepEqual(
    particular.items.map((i) => i.id),
    PARTICULAR_MENU_OPTIONS.map((o) => o.id),
  );
  for (const item of particular.items) {
    assert.equal(parseParticularMenuReply({ listId: item.id, body: item.item }), item.id);
  }
});

test("botões: ids reconhecidos pelo bot e títulos de até 20 caracteres", () => {
  const navback = byKey("navback").types["twilio/quick-reply"] as { body: string; actions: { title: string; id: string }[] };
  assert.equal(navback.body, "{{1}}");
  assert.deepEqual(navback.actions.map((a) => a.id), [NAV_BACK_ID]);
  assert.equal(parseNavReply({ buttonPayload: NAV_BACK_ID }), "back");

  const actions = byKey("actions").types["twilio/quick-reply"] as { actions: { title: string; id: string }[] };
  assert.deepEqual(actions.actions.map((a) => a.id), [PART_AGENDAR_ID, NAV_BACK_ID]);
  for (const a of [...navback.actions, ...actions.actions]) assert.ok(a.title.length <= 20, a.title);
  assert.equal(parseParticularActionReply({ buttonPayload: PART_AGENDAR_ID }), PART_AGENDAR_ID);
  assert.equal(parseParticularActionReply({ buttonPayload: NAV_BACK_ID }), NAV_BACK_ID);
});

test("só as telas de texto variável declaram variável; as listas têm corpo fixo", () => {
  assert.deepEqual(byKey("main").variables, {});
  assert.deepEqual(byKey("particular").variables, {});
  assert.deepEqual(Object.keys(byKey("navback").variables), ["1"]);
  assert.deepEqual(Object.keys(byKey("actions").variables), ["1"]);
});

test("corpo da criação na Twilio: REST em snake_case, português do Brasil", () => {
  const payload = contentCreatePayload(byKey("main"));
  assert.equal(payload.friendly_name, "fa_clinica_menu_inicial_v1");
  assert.equal(payload.language, "pt_BR");
  assert.ok("twilio/list-picker" in payload.types);
});

test("buildListItems recusa título longo, descrição longa e lista com mais de 10 itens", () => {
  assert.throws(() => buildListItems([{ id: "a", title: "x".repeat(LIST_TITLE_MAX + 1) }]), /caracteres/);
  assert.throws(() => buildListItems([{ id: "a", title: "ok", description: "x".repeat(73) }]), /Descrição/);
  assert.throws(() => buildListItems(Array.from({ length: 11 }, (_, i) => ({ id: `i${i}`, title: `t${i}` }))), /máximo 10/);
});
