// tests/playground-visit-confirmation-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVisitConfirmationLink,
  buildVisitConfirmationMessage,
  formatConfirmationWhen,
  formatSentAt,
} from "../lib/playground/visit-confirmation-pure.ts";

const TZ = "America/Sao_Paulo";

test("horário sai no fuso da clínica", () => {
  const w = formatConfirmationWhen("2026-11-18T17:00:00Z", TZ);
  assert.equal(w.time, "14:00");
  assert.equal(w.dateLabel, "quarta-feira, 18/11");
  assert.equal(formatSentAt("2026-11-18T17:05:00Z", TZ), "18/11 14:05");
});

test("mensagem traz criança, dia, hora e referência da unidade, sem a palavra playground", () => {
  const bosque = buildVisitConfirmationMessage({
    guardianName: "Maria Souza",
    patientName: "Pedro",
    dateLabel: "quarta-feira, 18/11",
    time: "14:00",
    unitName: "Bosque Grão-Pará",
  });
  assert.match(bosque, /^Olá, Maria! 💙/);
  assert.match(bosque, /Pedro/);
  assert.match(bosque, /quarta-feira, 18\/11, às 14:00/);
  assert.match(bosque, /de frente para a Loja Renner/);
  assert.doesNotMatch(bosque, /playground/i);

  const parque = buildVisitConfirmationMessage({
    patientName: "Pedro",
    dateLabel: "quarta-feira, 18/11",
    time: "14:00",
    unitName: "Parque Shopping",
  });
  assert.match(parque, /^Olá! 💙/);
  assert.match(parque, /próximo às Lojas Americanas/);
  assert.doesNotMatch(parque, /playground/i);
});

test("link wa.me usa o responsável financeiro com telefone e normaliza o número", () => {
  const href = buildVisitConfirmationLink({
    guardians: [
      { full_name: "Ana", phone: "", is_financial: true },
      { full_name: "João", phone: "(91) 98888-7777", is_financial: false },
    ],
    patientName: "Pedro",
    scheduledStartIso: "2026-11-18T17:00:00Z",
    unitName: "Parque Shopping",
    timeZone: TZ,
  });
  assert.ok(href?.startsWith("https://wa.me/5591988887777?text="));
  assert.match(decodeURIComponent(href!), /Olá, João!/);
});

test("sem telefone de nenhum responsável não há link", () => {
  const href = buildVisitConfirmationLink({
    guardians: [{ full_name: "Ana", phone: null, is_financial: true }],
    patientName: "Pedro",
    scheduledStartIso: "2026-11-18T17:00:00Z",
    unitName: "Parque Shopping",
    timeZone: TZ,
  });
  assert.equal(href, null);
});
