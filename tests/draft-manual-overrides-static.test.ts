// As correções da recepção sobrevivem à releitura dos documentos: onde são guardadas e onde são reaplicadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proc = readFileSync("lib/registration-drafts-process.ts", "utf8");
const actions = readFileSync("app/recepcao/pacientes/pendencias/draft-adjust-actions.ts", "utf8");
const ingest = readFileSync("lib/registration-drafts-ingest.ts", "utf8");

test("a releitura reaplica as correções nos dois caminhos que gravam extracted (com e sem arquivos)", () => {
  const writes = proc.match(/applyManualOverrides\(/g) ?? [];
  assert.equal(writes.length, 2);
  // O extraído gravado, o usado na separação de irmãos e o devolvido vêm do mesmo valor final.
  assert.match(proc, /extracted: finalExtracted as Json/);
  assert.match(proc, /const currentExtracted = finalExtracted as Json/);
});

test("a leitura das correções é tolerante: sem a coluna, a extração segue como antes", () => {
  assert.match(proc, /const manualOverrides = overrideError \? null :/);
  // O select principal (bot_collected, extracted) não pede a coluna nova: um erro nela derrubaria o bot_collected junto.
  assert.match(proc, /\.select\("bot_collected, extracted"\)/);
});

test("a extração só LÊ as correções; quem escreve é o Ajustar cadastro", () => {
  // Só aparece no select e no tipo da leitura (`manual_overrides: unknown`), nunca num update.
  assert.doesNotMatch(proc, /manual_overrides: (?!unknown)/);
  assert.doesNotMatch(proc, /manual_overrides:\s*[a-z]+\s+as Json/);
  assert.match(actions, /manual_overrides: overrides as Json/);
  assert.match(actions, /const previousOverrides = overrideError/);
});

test("zerar extracted ao chegar arquivo novo não toca nas correções (coluna própria)", () => {
  assert.doesNotMatch(ingest, /manual_overrides/);
});

test("migration da coluna é aditiva e opcional", () => {
  const sql = readFileSync("supabase/migrations/20261114150000_registration_drafts_manual_overrides.sql", "utf8");
  assert.match(sql, /add column if not exists manual_overrides jsonb;/);
  assert.doesNotMatch(sql, /not null|drop |delete |update /i);
});
