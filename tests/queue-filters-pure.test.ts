// tests/queue-filters-pure.test.ts
//
// Faixas de urgência e busca da Fila de pendências
// (app/recepcao/pacientes/pendencias/queue-filters-pure.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  highlightSegments,
  matchesSearch,
  normalizeSearch,
  urgencyBand,
} from "../app/recepcao/pacientes/pendencias/queue-filters-pure.ts";

const TZ = "America/Belem"; // UTC-3
// 21/09/2026 15:00 em Belém
const NOW = new Date("2026-09-21T18:00:00Z");
const base = { category: "guia_vencendo", overdue: false, escalated: false, dueAt: null as string | null };

test("escalado, atrasado e chegada no balcão vão para Agora", () => {
  assert.equal(urgencyBand({ ...base, escalated: true, dueAt: "2026-09-25T12:00:00Z" }, NOW, TZ), "agora");
  assert.equal(urgencyBand({ ...base, overdue: true }, NOW, TZ), "agora");
  assert.equal(urgencyBand({ ...base, category: "chegada_nao_confirmada" }, NOW, TZ), "agora");
});

test("prazo até o fim do dia vai para Hoje; amanhã e sem prazo, para Depois", () => {
  assert.equal(urgencyBand({ ...base, dueAt: "2026-09-21T22:00:00Z" }, NOW, TZ), "hoje");
  assert.equal(urgencyBand({ ...base, dueAt: "2026-09-22T15:00:00Z" }, NOW, TZ), "depois");
  assert.equal(urgencyBand(base, NOW, TZ), "depois");
  assert.equal(urgencyBand({ ...base, dueAt: "lixo" }, NOW, TZ), "depois");
});

test("o dia vale no fuso da clínica, não em UTC", () => {
  // 22/09 01:00 UTC ainda é 21/09 22:00 em Belém -> hoje
  assert.equal(urgencyBand({ ...base, dueAt: "2026-09-22T01:00:00Z" }, NOW, TZ), "hoje");
  // 22/09 03:30 UTC já é 22/09 00:30 em Belém -> depois
  assert.equal(urgencyBand({ ...base, dueAt: "2026-09-22T03:30:00Z" }, NOW, TZ), "depois");
});

const hay = normalizeSearch("Ana Luíza Reis · Pré-cadastro · falta Laudo · RG · +5591988887777 · Carla");

test("busca exige todas as palavras, sem acento e em qualquer ordem", () => {
  assert.equal(matchesSearch(hay, "luiza ana"), true);
  assert.equal(matchesSearch(hay, "ANA laudo"), true);
  assert.equal(matchesSearch(hay, "ana cpf"), false);
  assert.equal(matchesSearch(hay, "   "), true);
});

test("telefone casa pelos dígitos, em qualquer formato", () => {
  assert.equal(matchesSearch(hay, "(91) 98888-7777"), true);
  assert.equal(matchesSearch(hay, "8888"), true);
  assert.equal(matchesSearch(hay, "(91) 1234-5678"), false);
});

test("destaque devolve o texto original com os trechos marcados", () => {
  assert.deepEqual(highlightSegments("Ana Luíza", "luiza"), [
    { text: "Ana ", match: false },
    { text: "Luíza", match: true },
  ]);
  assert.deepEqual(highlightSegments("Ana", ""), [{ text: "Ana", match: false }]);
});
