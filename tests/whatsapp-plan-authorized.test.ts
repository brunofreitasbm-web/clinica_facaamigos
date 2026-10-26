import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlanAuthorizedMessage } from "../lib/whatsapp-message.ts";

test("mensagem lista terapias, quantidades e validade", () => {
  const msg = buildPlanAuthorizedMessage({
    guardianName: "Ítala",
    patientName: "Akin",
    validUntil: "2026-10-31",
    procedures: [
      { description: "TERAPIA OCUPACIONAL (08 SESSÕES) PREVENÇÃO - PACOTE - CLÍNICO", quantity: 1 },
      { description: "FONOAUDIOLOGIA - MÉTODO ABA - CLÍNICO", quantity: 8 },
    ],
  });
  assert.match(msg, /Olá, Ítala!/);
  assert.match(msg, /• Fonoaudiologia - Método ABA — 8 sessões/);
  assert.match(msg, /— 1 pacote/);
  assert.match(msg, /válida até 31\/10\/2026/);
  assert.match(msg, /agendamento da primeira avaliação já está liberado/);
});
