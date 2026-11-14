import { test } from "node:test";
import assert from "node:assert/strict";
import { sessaoVencidaPeloCorte, ultimoCorte } from "../lib/session-cutoff.ts";

test("antes das 19h BRT o corte é o de ontem", () => {
  const agora = new Date("2026-11-14T20:00:00Z"); // 17h BRT
  assert.equal(ultimoCorte(agora).toISOString(), "2026-11-13T22:00:00.000Z");
});

test("depois das 19h BRT o corte é o de hoje", () => {
  const agora = new Date("2026-11-14T22:30:00Z"); // 19h30 BRT
  assert.equal(ultimoCorte(agora).toISOString(), "2026-11-14T22:00:00.000Z");
});

test("login da manhã cai depois das 19h", () => {
  assert.equal(sessaoVencidaPeloCorte("2026-11-14T11:00:00Z", new Date("2026-11-14T22:05:00Z")), true);
});

test("login da manhã segue valendo às 17h", () => {
  assert.equal(sessaoVencidaPeloCorte("2026-11-14T11:00:00Z", new Date("2026-11-14T20:00:00Z")), false);
});

test("login depois das 19h vale até as 19h do dia seguinte", () => {
  const login = "2026-11-14T23:00:00Z"; // 20h BRT
  assert.equal(sessaoVencidaPeloCorte(login, new Date("2026-11-15T20:00:00Z")), false);
  assert.equal(sessaoVencidaPeloCorte(login, new Date("2026-11-15T22:01:00Z")), true);
});

test("sem data ou data inválida não derruba", () => {
  assert.equal(sessaoVencidaPeloCorte(null), false);
  assert.equal(sessaoVencidaPeloCorte("lixo"), false);
});
