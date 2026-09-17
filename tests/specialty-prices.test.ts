import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBRL, packageTotal } from "../lib/specialty-prices.ts";

test("formatBRL formata número em reais no padrão pt-BR", () => {
  assert.match(formatBRL(150), /R\$\s*150,00/);
  assert.match(formatBRL(1500), /R\$\s*1\.500,00/);
  assert.match(formatBRL(99.9), /R\$\s*99,90/);
});

test("packageTotal multiplica preço unitário pelo número de sessões", () => {
  assert.equal(packageTotal(150, 10), 1500);
  assert.equal(packageTotal(99.9, 4), 399.6);
  assert.equal(packageTotal(200, 0), 0);
});
