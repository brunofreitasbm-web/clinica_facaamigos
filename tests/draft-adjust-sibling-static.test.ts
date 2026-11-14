// Garantias de "Ajustar cadastro > Separar irmão" (draft-adjust-actions.ts), lidas do código-fonte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("app/recepcao/pacientes/pendencias/draft-adjust-actions.ts", "utf8");
const split = src.slice(src.indexOf("export async function splitSiblingFromDraft"));

test("o irmão entra na Fila como lead: paciente 'interessado' e rascunho aberto 'extracted'", () => {
  assert.match(split, /status: "interessado"/);
  assert.match(split, /status: "extracted"/);
  assert.doesNotMatch(split, /status: "validated"|status: "avaliacao"|validated_at|validated_by/);
});

test("o irmão não herda guia, autorização nem agendamento do contato de origem", () => {
  assert.doesNotMatch(split, /plan_authorized|scheduling_enabled|guide_sent|authorization_waived|authorized_guide|authorization_id/);
});

test("confere duplicidade por nome e nascimento e registra a separação na auditoria", () => {
  assert.match(split, /areNamesMatching\(p\.full_name, fullName\)/);
  assert.match(split, /draft_split_sibling_manual/);
});

test("a migration troca o índice único por um por telefone E criança, criando o novo antes de remover o antigo", () => {
  const sql = readFileSync("supabase/migrations/20261114130000_registration_drafts_one_open_per_child.sql", "utf8");
  const create = sql.indexOf("create unique index if not exists registration_drafts_one_open_whatsapp_per_child");
  const drop = sql.indexOf("drop index if exists registration_drafts_one_open_whatsapp;");
  assert.ok(create >= 0 && drop > create);
  assert.match(sql, /\(source_phone, coalesce\(patient_id,/);
});
