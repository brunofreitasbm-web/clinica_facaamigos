import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlanPill } from "../lib/patient-plan-pure.ts";

test("sem linhas: plano não identificado", () => {
  assert.equal(resolvePlanPill([]).kind, "unknown");
  assert.equal(resolvePlanPill(null).kind, "unknown");
});

test("linha sem convênio e sem is_private continua não identificado", () => {
  assert.equal(resolvePlanPill([{ is_private: false, insurers: null }]).kind, "unknown");
  assert.equal(resolvePlanPill([{ is_private: false, insurers: { name: "  " } }]).kind, "unknown");
});

test("is_private vira Particular com a cor padrão", () => {
  const pill = resolvePlanPill([{ is_private: true, insurers: null }]);
  assert.equal(pill.kind, "particular");
  assert.equal(pill.name, "Particular");
});

test("convênio identificado (objeto ou array) aparece com nome e cor", () => {
  const a = resolvePlanPill([{ is_private: false, insurers: { name: "Unimed", badge_color: "#16a34a" } }]);
  assert.deepEqual(a, { kind: "plan", name: "Unimed", color: "#16a34a" });
  const b = resolvePlanPill([{ is_private: false, insurers: [{ name: "IASEP" }] }]);
  assert.deepEqual(b, { kind: "plan", name: "IASEP", color: null });
});

test("convênio identificado vence Particular, em qualquer ordem", () => {
  const priv = { is_private: true, insurers: null };
  const plan = { is_private: false, insurers: { name: "Amil" } };
  assert.equal(resolvePlanPill([priv, plan]).name, "Amil");
  assert.equal(resolvePlanPill([plan, priv]).name, "Amil");
});
