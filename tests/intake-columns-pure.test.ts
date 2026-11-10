// tests/intake-columns-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingIntakeColumnError } from "../lib/intake-columns-pure.ts";

test("detecta o codigo 42703", () => {
  assert.equal(isMissingIntakeColumnError({ code: "42703", message: "x" }), true);
});

test("detecta mensagem que cita uma coluna nova", () => {
  assert.equal(isMissingIntakeColumnError({ message: "column registration_drafts.plan_denied_at does not exist" }), true);
  assert.equal(isMissingIntakeColumnError({ code: "PGRST200", message: "falta plan_more_docs_at" }), true);
});

test("ignora erro sem relacao", () => {
  assert.equal(isMissingIntakeColumnError({ code: "42501", message: "permission denied" }), false);
});

test("null e undefined nao sao erro de coluna", () => {
  assert.equal(isMissingIntakeColumnError(null), false);
  assert.equal(isMissingIntakeColumnError(undefined), false);
});
