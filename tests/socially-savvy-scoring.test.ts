// tests/socially-savvy-scoring.test.ts
//
// Verifica lib/socially-savvy/scoring.ts contra a aplicação já preenchida na
// própria planilha da clínica (Planilhas/SOCIALLY--SAVVY-PEI.xlsx, coluna
// "AV 1" da aba PROTOCOLO): as abas "AV 1" e "PEI" de lá são o gabarito dos
// totais por área e da separação de objetivos prioritários/demais.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOCIALLY_SAVVY_CATALOG } from "../lib/socially-savvy/catalog.ts";
import { computeSociallySavvyResults } from "../lib/socially-savvy/scoring.ts";
import type { SociallySavvyResponses } from "../lib/socially-savvy/types.ts";

// Habilidades pontuadas na AV 1 da planilha; as demais ficaram em branco.
const AV1: SociallySavvyResponses = {
  JA01: "2",
  SP01: "2",
  SP24: "0",
  SR01: "2",
  SR07: "2",
  SR18: "2",
  SE01: "2",
  SL01: "1",
  CG01: "3",
  NV6: "0",
};

test("catálogo tem as 110 habilidades das 7 áreas, com códigos únicos", () => {
  const codes = SOCIALLY_SAVVY_CATALOG.flatMap((a) => a.items.map((i) => i.code));
  assert.equal(SOCIALLY_SAVVY_CATALOG.length, 7);
  assert.equal(codes.length, 110);
  assert.equal(new Set(codes).size, 110);
  assert.ok(codes.every((c) => c.length > 0));
});

test("pontos por área reproduzem a aba 'AV 1' da planilha", () => {
  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, AV1);
  const byKey = Object.fromEntries(results.areas.map((a) => [a.key, a]));

  assert.deepEqual(
    [byKey.ja, byKey.sp, byKey.sr, byKey.se, byKey.sl, byKey.cg, byKey.nv].map((a) => [a.achieved, a.expected]),
    [
      [2, 27],
      [2, 72],
      [6, 54],
      [2, 18],
      [1, 72],
      [3, 69],
      [0, 18],
    ],
  );
  assert.equal(results.totalAchieved, 16);
  assert.equal(results.totalExpected, 330);
});

test("PEI: 2 vira objetivo prioritário, 0 e 1 viram demais objetivos, 3 sai do plano", () => {
  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, AV1);

  assert.deepEqual(
    results.priorityObjectives.map((o) => o.code),
    ["JA01", "SP01", "SR01", "SR07", "SR18", "SE01"],
  );
  assert.deepEqual(
    results.otherObjectives.map((o) => o.code),
    ["SP24", "SL01", "NV6"],
  );
  // CG01 foi pontuada com 3 (adquirida) e não entra em nenhuma das listas.
  assert.ok(![...results.priorityObjectives, ...results.otherObjectives].some((o) => o.code === "CG01"));
});

test("'NA' não soma pontos nem gera objetivo, e é contado separado do que ficou em branco", () => {
  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, { ...AV1, JA02: "NA" });
  const ja = results.areas.find((a) => a.key === "ja");

  assert.equal(ja?.achieved, 2);
  assert.equal(ja?.expected, 27); // denominador da planilha não desconta NA
  assert.equal(ja?.naItems, 1);
  assert.equal(ja?.scoredItems, 1);
  assert.equal(ja?.unansweredItems, 7);
  assert.ok(!results.otherObjectives.some((o) => o.code === "JA02"));
});

test("protocolo inteiro adquirido zera o PEI e crava 100%", () => {
  const all: SociallySavvyResponses = {};
  for (const area of SOCIALLY_SAVVY_CATALOG) for (const item of area.items) all[item.code] = "3";

  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, all);
  assert.equal(results.totalAchieved, 330);
  assert.equal(results.totalPercent, 1);
  assert.equal(results.priorityObjectives.length, 0);
  assert.equal(results.otherObjectives.length, 0);
});
