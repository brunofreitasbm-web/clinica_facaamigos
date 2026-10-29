// tests/patient-journey.test.ts
//
// Status real do quadro "Próximo passo" (lib/patient-journey-pure.ts):
// plano autorizado vem antes da avaliação; avaliação cancelada não conta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeJourney, type JourneyInput } from "../lib/patient-journey-pure.ts";

const base: JourneyInput = {
  patient: { status: "avaliacao", evaluated_at: null, first_session_at: null },
  planAuthorizedByDraft: true,
  guideSent: true,
  authorizationWaived: false,
  hasActiveAuthorization: false,
  evaluations: [],
  formatDateTime: (iso) => iso.slice(0, 10),
};

test("autorizado sem avaliação válida: aguarda agendar", () => {
  const j = computeJourney(base);
  assert.equal(j.key, "agendar_avaliacao");
  assert.equal(j.step, 2);
});

test("avaliação cancelada pela clínica não conta como agendada e explica o motivo", () => {
  const j = computeJourney({
    ...base,
    authorizationWaived: true,
    evaluations: [{ starts_at: "2026-11-06T13:00:00Z", status: "cancelada_clinica" }],
  });
  assert.equal(j.key, "agendar_avaliacao");
  assert.match(j.detail ?? "", /2026-11-06.*cancelada pela clínica/);
});

test("avaliação agendada: aguarda a 1ª avaliação com data", () => {
  const j = computeJourney({ ...base, evaluations: [{ starts_at: "2026-11-10T13:00:00Z", status: "agendada" }] });
  assert.equal(j.key, "avaliacao_agendada");
  assert.equal(j.step, 3);
  assert.match(j.detail ?? "", /2026-11-10/);
});

test("avaliada sem guia ativa nem dispensa: registrar guia", () => {
  const j = computeJourney({ ...base, patient: { ...base.patient, evaluated_at: "2026-11-10" } });
  assert.equal(j.key, "registrar_guia");
});

test("avaliada e particular (dispensa): vai direto para a grade", () => {
  const j = computeJourney({
    ...base,
    authorizationWaived: true,
    patient: { ...base.patient, evaluated_at: "2026-11-10" },
  });
  assert.equal(j.key, "montar_grade");
});

test("interessado sem autorização: etapa 1, distingue guia enviada", () => {
  const pending = { ...base, planAuthorizedByDraft: false, patient: { ...base.patient, status: "interessado" } };
  assert.equal(computeJourney({ ...pending, guideSent: false }).key, "aguardando_envio_guia");
  assert.equal(computeJourney(pending).key, "aguardando_autorizacao");
});

test("ativo ou com 1ª sessão: sem ação", () => {
  const j = computeJourney({ ...base, patient: { ...base.patient, first_session_at: "2026-11-20" } });
  assert.equal(j.key, "ativo");
  assert.equal(j.ctaLabel, null);
});
