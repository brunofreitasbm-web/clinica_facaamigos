// tests/family-share-permission.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Função de auxílio de validação de permissão para o botão "Compartilhar
 * com a família" no Prontuário Unificado (generateFamilyShare,
 * app/supervisao/prontuario-unificado/actions.ts).
 */
export function canShareFamilyPdf(role?: string | null): boolean {
  if (!role) return false;
  const allowedRoles = ["supervisor", "gestor"];
  return allowedRoles.includes(role.toLowerCase());
}

test("Permite compartilhar PDF com a família apenas para Supervisor e Gestor", () => {
  assert.equal(canShareFamilyPdf("supervisor"), true);
  assert.equal(canShareFamilyPdf("SUPERVISOR"), true);
  assert.equal(canShareFamilyPdf("gestor"), true);
  assert.equal(canShareFamilyPdf("GESTOR"), true);
});

test("Bloqueia compartilhamento de PDF com a família para outros perfis", () => {
  assert.equal(canShareFamilyPdf("terapeuta"), false);
  assert.equal(canShareFamilyPdf("recepcao"), false);
  assert.equal(canShareFamilyPdf("faturamento"), false);
  assert.equal(canShareFamilyPdf("responsavel"), false);
  assert.equal(canShareFamilyPdf(null), false);
  assert.equal(canShareFamilyPdf(undefined), false);
});
