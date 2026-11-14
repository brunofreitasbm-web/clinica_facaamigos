// tests/balance-cell-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldSaveBalance } from "../lib/balance-cell-pure.ts";

test("não salva sem mudança, salva com mudança", () => {
  assert.equal(shouldSaveBalance("100", 100), false);
  assert.equal(shouldSaveBalance("100.50", 100), true);
});

test("voltar ao valor original depois de salvar outro valor volta a salvar", () => {
  // abriu com 100, salvou 200 (último gravado = 200), digitou 100 de novo
  assert.equal(shouldSaveBalance("100", 200), true);
});

test("campo vazio conta como 0; texto inválido não salva", () => {
  assert.equal(shouldSaveBalance("", 0), false);
  assert.equal(shouldSaveBalance("", 50), true);
  assert.equal(shouldSaveBalance("abc", 50), false);
});

test("a célula de saldo não descarta o resultado do salvamento (HUB-02)", () => {
  const src = readFileSync("app/gestor/financeiro-hub/lancamentos/balance-cell.tsx", "utf8");
  assert.ok(!/if \(res\.success\) setSavedAt/.test(src), "voltou a ignorar a falha");
  assert.ok(/res\.error/.test(src), "a mensagem de erro precisa chegar ao operador");
});
