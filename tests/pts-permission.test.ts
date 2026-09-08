// tests/pts-permission.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Função de auxílio de validação de permissão para criação de PTS
 */
export function canCreatePts(role?: string | null): boolean {
  if (!role) return false;
  const allowedRoles = ["supervisor", "gestor"];
  return allowedRoles.includes(role.toLowerCase());
}

test("Permite criação de PTS apenas para Supervisor e Gestor", () => {
  assert.equal(canCreatePts("supervisor"), true);
  assert.equal(canCreatePts("SUPERVISOR"), true);
  assert.equal(canCreatePts("gestor"), true);
  assert.equal(canCreatePts("GESTOR"), true);
});

test("Bloqueia criação de PTS para outros perfis", () => {
  assert.equal(canCreatePts("terapeuta"), false);
  assert.equal(canCreatePts("recepcao"), false);
  assert.equal(canCreatePts("faturamento"), false);
  assert.equal(canCreatePts("responsavel"), false);
  assert.equal(canCreatePts(null), false);
  assert.equal(canCreatePts(undefined), false);
});
