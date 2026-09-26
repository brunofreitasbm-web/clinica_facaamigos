// tests/nps-anamnese-dispatch.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnamneseNpsPayload } from "../lib/nps-dispatch-pure.ts";

test("buildAnamneseNpsPayload: formata mensagem e variáveis de NPS com nomes do responsável e paciente", () => {
  const payload = buildAnamneseNpsPayload("Maria da Silva", "Lucas Silva", "https://app.clinica.test");

  assert.equal(payload.guardianFirstName, "Maria");
  assert.equal(payload.patientFirstName, "Lucas");
  assert.equal(payload.surveyUrl, "https://app.clinica.test/familia/pesquisa");
  assert.equal(
    payload.messageText,
    "Olá, Maria! Como foi a experiência na 1ª Avaliação/Anamnese de Lucas? Por favor, responda nossa pesquisa de satisfação: https://app.clinica.test/familia/pesquisa"
  );
});

test("buildAnamneseNpsPayload: tolera nomes nulos ou vazios com fallbacks amigáveis", () => {
  const payload = buildAnamneseNpsPayload(null, "", "https://app.clinica.test");

  assert.equal(payload.guardianFirstName, "Responsável");
  assert.equal(payload.patientFirstName, "Paciente");
  assert.equal(
    payload.messageText,
    "Olá, Responsável! Como foi a experiência na 1ª Avaliação/Anamnese de Paciente? Por favor, responda nossa pesquisa de satisfação: https://app.clinica.test/familia/pesquisa"
  );
});
