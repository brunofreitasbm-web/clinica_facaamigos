import test from "node:test";
import assert from "node:assert/strict";
import { BAN_LEVANTADO, BAN_PERMANENTE, banDurationFor, isProfileBlocked } from "../lib/profile-access.ts";

test("colaborador desativado é bloqueado; ativo, nulo ou sem perfil segue como antes", () => {
  for (const role of ["gestor", "supervisor", "terapeuta", "recepcao", "faturamento"]) {
    assert.equal(isProfileBlocked({ role, active: false }), true, role);
    assert.equal(isProfileBlocked({ role, active: true }), false, role);
    assert.equal(isProfileBlocked({ role, active: null }), false, role);
    assert.equal(isProfileBlocked({ role }), false, role);
  }
  assert.equal(isProfileBlocked(null), false);
  assert.equal(isProfileBlocked(undefined), false);
});

test("a família (responsavel) nunca é bloqueada por `active`", () => {
  assert.equal(isProfileBlocked({ role: "responsavel", active: false }), false);
});

test("desativar bane o login; reativar levanta o banimento", () => {
  assert.equal(banDurationFor(false), BAN_PERMANENTE);
  assert.equal(banDurationFor(true), BAN_LEVANTADO);
  assert.equal(BAN_LEVANTADO, "none");
});
