// tests/reagendamentos-fila.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/supervisao/reagendamentos/page.tsx", "utf8");
const actions = readFileSync("app/supervisao/reagendamentos/actions.ts", "utf8");
const header = readFileSync("components/supervisao-header.tsx", "utf8");

test("a fila lê o nome do paciente pela coluna real (patients.full_name)", () => {
  assert.ok(page.includes("patients ( id, full_name )"));
  assert.ok(!/patients\s*\(\s*id,\s*name\s*\)/.test(page));
});

test("recusar cancela com motivo e responsável; nunca apaga o agendamento", () => {
  assert.ok(!/\.delete\(\)/.test(page) && !/\.delete\(\)/.test(actions));
  assert.match(actions, /status: "cancelada_clinica"/);
  assert.match(actions, /cancel_reason: REJECTION_REASON/);
  assert.match(actions, /cancelled_by: ctx\.user\.id/);
});

test("a decisão só vale para horário ainda pendente (evita decidir duas vezes)", () => {
  assert.equal((actions.match(/\.eq\("status", PENDING_STATUS\)/g) ?? []).length, 2);
});

test("a fila de reagendamentos tem entrada no menu da Supervisão", () => {
  assert.ok(header.includes('href: "/supervisao/reagendamentos"'));
});
