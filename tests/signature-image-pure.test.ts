// tests/signature-image-pure.test.ts — assinatura sem fundo (lib/signature-image-pure.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { inkAlpha, inkBounds } from "../lib/signature-image-pure.ts";

test("papel claro vira transparente e tinta escura fica opaca", () => {
  assert.equal(inkAlpha(255), 0);
  assert.equal(inkAlpha(200), 0);
  assert.equal(inkAlpha(165), 0);
  assert.equal(inkAlpha(0), 255);
  assert.equal(inkAlpha(70), 255);
  const meio = inkAlpha(120);
  assert.ok(meio > 0 && meio < 255);
});

test("recorte acha a tinta com margem, ignora sujeira solta e devolve null sem tinta", () => {
  const w = 40, h = 30;
  const a = new Uint8Array(w * h);
  // traço da assinatura: bloco 10x5 em x=12..21, y=10..14
  for (let y = 10; y <= 14; y++) for (let x = 12; x <= 21; x++) a[y * w + x] = 255;
  a[1 * w + 1] = 255; // pontinho de sujeira num canto
  a[28 * w + 38] = 255; // outro
  assert.deepEqual(inkBounds(a, w, h, 2, 3), { left: 10, top: 8, width: 14, height: 9 });
  assert.equal(inkBounds(new Uint8Array(w * h), w, h), null);
});
