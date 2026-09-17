import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReceiptNumber } from "../lib/receipts.ts";

test("formatReceiptNumber - zero-pad o sequencial em 4 dígitos", () => {
  assert.equal(formatReceiptNumber(2026, 12), "2026/0012");
});

test("formatReceiptNumber - não trunca sequenciais com 4+ dígitos", () => {
  assert.equal(formatReceiptNumber(2026, 12345), "2026/12345");
});

test("formatReceiptNumber - primeiro recibo do ano", () => {
  assert.equal(formatReceiptNumber(2027, 1), "2027/0001");
});
