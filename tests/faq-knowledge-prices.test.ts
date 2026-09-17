import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPricesBlock } from "../lib/specialty-prices.ts";

test("formatPricesBlock cita preço, duração e o cálculo do pacote mensal", () => {
  const block = formatPricesBlock(
    [
      { label: "Psicoterapia", price: 150, duration_minutes: 30 },
      { label: "Fonoaudiologia", price: 180, duration_minutes: 50 },
    ],
    10,
  );

  assert.match(block, /R\$\s*150,00/);
  assert.match(block, /30 min/);
  assert.match(block, /Psicoterapia/);
  assert.match(block, /Fonoaudiologia/);
  assert.match(block, /R\$\s*180,00/);
  assert.match(block, /N = 10/);
});

test("formatPricesBlock lida com lista vazia sem quebrar", () => {
  const block = formatPricesBlock([], 10);
  assert.match(block, /nenhum preço particular cadastrado/);
});
