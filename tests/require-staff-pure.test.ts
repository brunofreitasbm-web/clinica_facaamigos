import test from "node:test";
import assert from "node:assert/strict";
import { isStaffProfile } from "../lib/require-staff-pure.ts";
import { safeSecretEqual } from "../lib/cron-auth.ts";
import { isUuid } from "../lib/uuid.ts";

test("equipe ativa passa; família, sem perfil e inativo são negados", () => {
  for (const role of ["gestor", "supervisor", "terapeuta", "recepcao", "faturamento"]) {
    assert.equal(isStaffProfile({ role, active: true }), true, role);
    assert.equal(isStaffProfile({ role }), true, role);
    assert.equal(isStaffProfile({ role, active: false }), false, role);
  }
  assert.equal(isStaffProfile({ role: "responsavel", active: true }), false);
  assert.equal(isStaffProfile({ role: null }), false);
  assert.equal(isStaffProfile(null), false);
  assert.equal(isStaffProfile(undefined), false);
});

test("lista de papéis permitidos restringe", () => {
  assert.equal(isStaffProfile({ role: "recepcao" }, ["supervisor", "gestor"]), false);
  assert.equal(isStaffProfile({ role: "supervisor" }, ["supervisor", "gestor"]), true);
});

test("segredo de cron: falha fechada e comparação exata", () => {
  assert.equal(safeSecretEqual("abc", "abc"), true);
  assert.equal(safeSecretEqual("abc", "abd"), false);
  assert.equal(safeSecretEqual("abc", "abcd"), false);
  assert.equal(safeSecretEqual("", "abc"), false);
  assert.equal(safeSecretEqual("abc", undefined), false);
  assert.equal(safeSecretEqual(null, null), false);
});

test("isUuid barra injeção em filtros do PostgREST", () => {
  assert.equal(isUuid("3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f"), true);
  assert.equal(isUuid("x,patient_id.neq.0"), false);
  assert.equal(isUuid(""), false);
  assert.equal(isUuid(undefined), false);
});
