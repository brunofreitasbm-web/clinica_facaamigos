// tests/session-note-contract.test.ts
//
// PRD §7.1 avisa explicitamente: a métrica data_collection_rate lê
// `session_notes.structured -> 'metas_trabalhadas'`, um contrato entre
// TypeScript (lib/session-note-fields.ts) e SQL (supabase/migrations/
// 20260907170004_data_collection_rate_metas.sql) que nenhuma ferramenta de
// tipos detecta se quebrar. Um teste puro de TS não pegaria um rename —
// passaria feliz enquanto o SQL parasse de casar. Por isso o teste #3 lê o
// arquivo de migration do disco e verifica o literal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  SESSION_NOTE_METAS_KEY,
  GOAL_RESULT_LEVELS,
  buildSessionNoteStructured,
  getMetasTrabalhadas,
} from "../lib/session-note-fields.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

test("SESSION_NOTE_METAS_KEY é 'metas_trabalhadas'", () => {
  assert.equal(SESSION_NOTE_METAS_KEY, "metas_trabalhadas");
});

test("buildSessionNoteStructured grava exatamente as 4 chaves esperadas", () => {
  const structured = buildSessionNoteStructured({
    presencaEngajamento: 4,
    metasTrabalhadas: [{ plan_goal_id: "g1", resultado: "independente" }],
    comportamentos: [{ tipo: "agitacao", intensidade: "leve" }],
    orientacoes: ["rotina"],
  });
  assert.deepEqual(
    Object.keys(structured).sort(),
    ["comportamentos", "metas_trabalhadas", "orientacoes", "presenca_engajamento"],
  );
});

test("a migration da métrica lê a mesma chave de SESSION_NOTE_METAS_KEY", () => {
  const migrationPath = path.join(
    REPO_ROOT,
    "supabase",
    "migrations",
    "20260907170004_data_collection_rate_metas.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");
  assert.ok(
    sql.includes(`structured->'${SESSION_NOTE_METAS_KEY}'`),
    `Migration não contém o literal structured->'${SESSION_NOTE_METAS_KEY}' — data_collection_rate quebrou em silêncio.`,
  );
});

test("GOAL_RESULT_LEVELS tem exatamente os 4 níveis do PRD §9.4, na ordem", () => {
  assert.deepEqual(
    GOAL_RESULT_LEVELS.map((r) => r.value),
    ["nao_iniciou", "em_aquisicao", "atingiu_com_ajuda", "independente"],
  );
});

test("getMetasTrabalhadas não lança para uma evolução anterior à chave (compat)", () => {
  const legacyStructured = {
    presenca_engajamento: 3,
    comportamentos: [],
    orientacoes: [],
  } as unknown as Parameters<typeof getMetasTrabalhadas>[0];
  assert.deepEqual(getMetasTrabalhadas(legacyStructured), []);
  assert.deepEqual(getMetasTrabalhadas(null), []);
  assert.deepEqual(getMetasTrabalhadas(undefined), []);
});
