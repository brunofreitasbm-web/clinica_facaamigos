import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterIntakeItems,
  groupItems,
  isOverdue,
  legacyTab,
  waitLabel,
} from "../app/recepcao/a-autorizar/intake-filters-pure.ts";
import { INTAKE_GROUP_ORDER, type IntakeGroup } from "../lib/intake-queue-pure.ts";

const NOW = new Date("2026-11-10T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

type Item = { id: string; group: IntakeGroup; waitingSince: string; haystack: string; mine: boolean };
const item = (id: string, group: IntakeGroup, days: number, haystack = id, mine = false): Item => ({
  id, group, waitingSince: daysAgo(days), haystack, mine,
});

test("groupItems ordena por espera, mais antigo primeiro, dentro de cada grupo", () => {
  const out = groupItems([
    item("novo", "agir_agora", 1),
    item("velho", "agir_agora", 9),
    item("meio", "agir_agora", 4),
    item("plano", "aguardando_plano", 2),
  ]);
  assert.deepEqual(out.agir_agora.map((i) => i.id), ["velho", "meio", "novo"]);
  assert.deepEqual(out.aguardando_plano.map((i) => i.id), ["plano"]);
  assert.deepEqual(out.concluidos, []);
});

test("groupItems nao altera a lista original", () => {
  const input = [item("b", "agir_agora", 1), item("a", "agir_agora", 5)];
  groupItems(input);
  assert.deepEqual(input.map((i) => i.id), ["b", "a"]);
});

test("soma das abas e igual ao total", () => {
  const items = [
    item("1", "agir_agora", 1), item("2", "aguardando_familia", 2), item("3", "aguardando_plano", 3),
    item("4", "concluidos", 4), item("5", "agir_agora", 5),
  ];
  const out = groupItems(items);
  const sum = INTAKE_GROUP_ORDER.reduce((n, g) => n + out[g].length, 0);
  assert.equal(sum, items.length);
});

test("isOverdue: 4 dias nao, 5 e 6 dias sim", () => {
  assert.equal(isOverdue(daysAgo(4), NOW), false);
  assert.equal(isOverdue(daysAgo(5), NOW), true);
  assert.equal(isOverdue(daysAgo(6), NOW), true);
  assert.equal(isOverdue("invalido", NOW), false);
});

test("waitLabel", () => {
  assert.equal(waitLabel(daysAgo(0), NOW), "hoje");
  assert.equal(waitLabel(daysAgo(1), NOW), "há 1 dia");
  assert.equal(waitLabel(daysAgo(4), NOW), "há 4 dias");
});

// O haystack do item já vem sem acento e em minúsculas (ver WorkspaceItem); a busca é que normaliza.
test("busca por nome ignora acento e caixa", () => {
  const items = [item("a", "agir_agora", 1, "joao da silva 91988887777"), item("b", "agir_agora", 1, "maria souza")];
  const out = filterIntakeItems(items, { search: "JOÃO", onlyMine: false });
  assert.deepEqual(out.map((i) => i.id), ["a"]);
});

test("busca por telefone casa pelos digitos", () => {
  const items = [item("a", "agir_agora", 1, "joao 91988887777"), item("b", "agir_agora", 1, "maria 91977776666")];
  const out = filterIntakeItems(items, { search: "(91) 98888-7777", onlyMine: false });
  assert.deepEqual(out.map((i) => i.id), ["a"]);
});

test("Só os meus", () => {
  const items = [item("a", "agir_agora", 1, "a", true), item("b", "agir_agora", 1, "b", false)];
  assert.deepEqual(filterIntakeItems(items, { search: "", onlyMine: true }).map((i) => i.id), ["a"]);
  assert.equal(filterIntakeItems(items, { search: "", onlyMine: false }).length, 2);
});

test("legacyTab mapeia parametros antigos", () => {
  assert.equal(legacyTab({ etapa: "docs" }), "agir_agora");
  assert.equal(legacyTab({ etapa: "autorizacao" }), "aguardando_plano");
  assert.equal(legacyTab({ status: "concluidas" }), "concluidos");
  assert.equal(legacyTab({ status: "todos" }), null);
  assert.equal(legacyTab({}), null);
});
