import test from "node:test";
import assert from "node:assert/strict";
import { maskCpf, maskEmail } from "../lib/masks.ts";

test("maskCpf esconde os 3 primeiros e os 2 últimos dígitos", () => {
  assert.equal(maskCpf("123.456.789-12"), "***.456.789-**");
  assert.equal(maskCpf("12345678912"), "***.456.789-**");
});

test("maskCpf com valor incompleto não vaza dígitos; vazio vira null", () => {
  assert.equal(maskCpf("1234"), "***.***.***-**");
  assert.equal(maskCpf(null), null);
  assert.equal(maskCpf(""), null);
});

test("maskEmail mantém só a inicial e o domínio", () => {
  assert.equal(maskEmail("joana@exemplo.com"), "j***@exemplo.com");
  assert.equal(maskEmail(null), null);
});
