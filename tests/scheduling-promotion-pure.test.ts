// tests/scheduling-promotion-pure.test.ts
//
// Agendar a avaliação só promove o paciente a "avaliacao" quando não há
// autorização pendente na esteira de documentos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldPromoteOnScheduling } from "../lib/scheduling-promotion-pure.ts";

test("sem contato na esteira (cadastro presencial): promove", () => {
  assert.equal(shouldPromoteOnScheduling(undefined), true);
});

test("habilitado (plano autorizou, dispensa ou guia ativa): promove", () => {
  assert.equal(shouldPromoteOnScheduling("habilitado"), true);
});

test("ainda esperando guia ou plano: não promove", () => {
  assert.equal(shouldPromoteOnScheduling("aguardando_envio_guia"), false);
  assert.equal(shouldPromoteOnScheduling("aguardando_autorizacao"), false);
  assert.equal(shouldPromoteOnScheduling("aguardando_habilitacao"), false);
});
