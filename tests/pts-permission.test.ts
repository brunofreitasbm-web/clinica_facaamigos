// tests/pts-permission.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Função de auxílio de validação de permissão para criação de PTS
 */
export function canCreatePts(role?: string | null, canCreatePtsFlag = false): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  if (["supervisor", "gestor"].includes(r)) return true;
  return r === "terapeuta" && canCreatePtsFlag;
}

test("Permite criação de PTS para Supervisor e Gestor", () => {
  assert.equal(canCreatePts("supervisor"), true);
  assert.equal(canCreatePts("SUPERVISOR"), true);
  assert.equal(canCreatePts("gestor"), true);
  assert.equal(canCreatePts("GESTOR"), true);
});

test("Terapeuta só cria PTS com a flag can_create_pts", () => {
  assert.equal(canCreatePts("terapeuta", true), true);
  assert.equal(canCreatePts("terapeuta", false), false);
  assert.equal(canCreatePts("recepcao", true), false);
});

test("Bloqueia criação de PTS para outros perfis", () => {
  assert.equal(canCreatePts("terapeuta"), false);
  assert.equal(canCreatePts("recepcao"), false);
  assert.equal(canCreatePts("faturamento"), false);
  assert.equal(canCreatePts("responsavel"), false);
  assert.equal(canCreatePts(null), false);
  assert.equal(canCreatePts(undefined), false);
});

/**
 * PTS só pode ser iniciado para paciente que concluiu a 1ª
 * avaliação/anamnese/acolhimento (patients.evaluated_at preenchido).
 */
export function canStartPts(evaluatedAt?: string | null): boolean {
  return Boolean(evaluatedAt);
}

test("Permite iniciar PTS apenas após avaliação/anamnese/acolhimento concluída", () => {
  assert.equal(canStartPts("2026-09-10T12:00:00Z"), true);
  assert.equal(canStartPts(null), false);
  assert.equal(canStartPts(undefined), false);
});
