// tests/evaluation-guidance-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvaluationGuidanceMessage } from "../lib/evaluation-guidance-pure.ts";

test("orientações citam a criança, os 15 minutos e os documentos", () => {
  const msg = buildEvaluationGuidanceMessage("Ian Tavares");
  assert.match(msg, /Seu 1º agendamento está confirmado/);
  assert.match(msg, /15 minutos de antecedência/);
  assert.match(msg, /exames, laudos e documentações de Ian Tavares/);
});

test("fecha com a assinatura da clínica", () => {
  assert.ok(buildEvaluationGuidanceMessage("X").endsWith("FaçaAmigos - Centro de Terapia Comportamental"));
});
