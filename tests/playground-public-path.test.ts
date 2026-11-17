// tests/playground-public-path.test.ts
//
// A ponte do PDV chama /api/playground/* sem cookie de sessão. Se o prefixo sair
// de PUBLIC_PREFIXES, o middleware redireciona para /login e a ponte para de
// funcionar sem nenhum erro óbvio. Todas as rotas devem se autenticar por HMAC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_PREFIXES } from "../lib/public-paths.ts";

test("/api/playground é público no middleware", () => {
  assert.ok(PUBLIC_PREFIXES.includes("/api/playground"));
});

test("toda rota de /api/playground verifica a assinatura antes de agir", () => {
  const root = "app/api/playground";
  const routes = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
  assert.ok(routes.length >= 6, "today, visit, entries, conclude, transcribe e replay");
  for (const dir of routes) {
    const src = readFileSync(join(root, dir, "route.ts"), "utf8");
    assert.match(src, /readSignedBody\(/, `${dir} deve autenticar com readSignedBody`);
    assert.ok(
      src.indexOf("readSignedBody(") < src.indexOf("createAdminClient(") || !src.includes("createAdminClient("),
      `${dir} não pode abrir o cliente admin antes de validar a assinatura`,
    );
  }
});

import { findPlaygroundUnit, normalizePosUnitId, PLAYGROUND_UNITS } from "../lib/playground/units.ts";

test("código da unidade do PDV: só UUID, normalizado", () => {
  assert.equal(normalizePosUnitId("5FC99A57-81EE-4232-A105-1FCB4634CEF4"), "5fc99a57-81ee-4232-a105-1fcb4634cef4");
  assert.equal(normalizePosUnitId("  11111111-1111-1111-1111-111111111111 "), "11111111-1111-1111-1111-111111111111");
  assert.equal(normalizePosUnitId("01"), null);
  assert.equal(normalizePosUnitId(""), null);
});

test("só os playgrounds são aceitos: o Circuito e códigos digitados à mão não", () => {
  assert.equal(PLAYGROUND_UNITS.length, 2);
  assert.equal(findPlaygroundUnit("5FC99A57-81EE-4232-A105-1FCB4634CEF4")?.name, "Bosque Grão-Pará");
  assert.equal(findPlaygroundUnit("11111111-1111-1111-1111-111111111111")?.name, "Parque Shopping");
  // Circuito (Parque Shopping): existe no PDV, mas não é playground.
  assert.equal(findPlaygroundUnit("e43ba7a8-bd5f-47ad-b81d-dae7ea19d504"), null);
  assert.equal(findPlaygroundUnit("01"), null);
});

import { isAllowedVisitDuration, PLAYGROUND_VISIT_DURATIONS } from "../lib/playground/constants.ts";

test("duração da visita: só 2 horas (120 minutos)", () => {
  assert.deepEqual([...PLAYGROUND_VISIT_DURATIONS], [120]);
  assert.equal(isAllowedVisitDuration(120), true);
  for (const bad of [0, 45, 60, 90, 119, 180, NaN]) assert.equal(isAllowedVisitDuration(bad), false, String(bad));
});
