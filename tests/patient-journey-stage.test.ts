import { test } from "node:test";
import assert from "node:assert/strict";
import { computeJourneyStage } from "../lib/patient-status.ts";

test("etapa: avaliado sem plano", () => {
  assert.equal(computeJourneyStage({ status: "avaliacao", first_session_at: null }, []), "avaliado");
});
test("etapa: plano em rascunho = aguardando o PTS", () => {
  assert.equal(computeJourneyStage({ status: "avaliacao", first_session_at: null }, ["rascunho"]), "aguardando_pts");
});
test("etapa: plano aprovado = PTS feito", () => {
  assert.equal(computeJourneyStage({ status: "avaliacao", first_session_at: null }, ["encerrado", "aprovado"]), "pts_feito");
});
test("etapa: 1ª sessão ou status ativo = em tratamento", () => {
  assert.equal(computeJourneyStage({ status: "avaliacao", first_session_at: "2026-11-10T10:00:00Z" }, ["aprovado"]), "em_tratamento");
  assert.equal(computeJourneyStage({ status: "ativo", first_session_at: null }, []), "em_tratamento");
});
