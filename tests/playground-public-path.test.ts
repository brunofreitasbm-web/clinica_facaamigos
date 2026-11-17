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
