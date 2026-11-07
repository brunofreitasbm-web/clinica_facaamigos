// tests/handoff-resume-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildResumeSnapshot,
  decideResumeOffer,
  isResumableSession,
  parseResumeReply,
  resumeQuestionFor,
  shouldAlertPendingSla,
  type ResumeSnapshot,
} from "../lib/handoff-resume-pure.ts";

const NOW = Date.parse("2026-11-09T14:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const snap: ResumeSnapshot = {
  step: "awaiting_child_birth_date",
  flow: null,
  lead_id: null,
  collected_data: { child_name: "Ana Souza" },
  captured_at: ago(20),
  offered_at: null,
};
const base = {
  snapshot: snap,
  escalatedAt: ago(20),
  nowMs: NOW,
  minutes: 15,
  lastHumanOutboundAt: null,
  humanAttending: false,
  withinBusinessHours: true,
  windowOpen: true,
};

test("só guarda etapas retomáveis", () => {
  assert.equal(isResumableSession({ current_step: "awaiting_plan", flow: null }), true);
  assert.equal(isResumableSession({ current_step: "eval_offer_awaiting_choice", flow: "eval_offer" }), true);
  for (const s of [
    { current_step: "idle", flow: null },
    { current_step: "completed", flow: null },
    { current_step: "pending_supervisor", flow: null },
    { current_step: "awaiting_slot_selection", flow: null },
    { current_step: "pre_anamnesis_consent", flow: null },
    { current_step: "absence_awaiting_choice", flow: null },
    { current_step: "intake_awaiting_documents", flow: null },
  ]) {
    assert.equal(isResumableSession(s), false, s.current_step);
  }
  assert.equal(isResumableSession(null), false);
});

test("buildResumeSnapshot copia etapa e dados, ou devolve null", () => {
  const s = buildResumeSnapshot({ current_step: "awaiting_plan", flow: null, collected_data: { a: 1 } }, "2026-11-09T13:00:00Z");
  assert.equal(s?.step, "awaiting_plan");
  assert.deepEqual(s?.collected_data, { a: 1 });
  assert.equal(buildResumeSnapshot({ current_step: "idle", flow: null }, "x"), null);
});

test("oferece depois de X minutos, em horário comercial, sem humano", () => {
  assert.deepEqual(decideResumeOffer(base), { offer: true, reason: "ok" });
});

test("não oferece: cedo demais, desligado, sem etapa, já ofereceu", () => {
  assert.equal(decideResumeOffer({ ...base, escalatedAt: ago(5) }).reason, "cedo_demais");
  assert.equal(decideResumeOffer({ ...base, minutes: 0 }).reason, "desligado");
  assert.equal(decideResumeOffer({ ...base, minutes: null }).reason, "desligado");
  assert.equal(decideResumeOffer({ ...base, snapshot: null }).reason, "sem_etapa");
  assert.equal(decideResumeOffer({ ...base, snapshot: { ...snap, offered_at: ago(1) } }).reason, "ja_ofereceu");
});

test("não oferece com humano atendendo ou que já respondeu desde o escalonamento", () => {
  assert.equal(decideResumeOffer({ ...base, humanAttending: true }).reason, "humano_atendendo");
  assert.equal(decideResumeOffer({ ...base, lastHumanOutboundAt: ago(10) }).reason, "humano_respondeu");
  // Mensagem humana ANTERIOR ao escalonamento não bloqueia.
  assert.equal(decideResumeOffer({ ...base, lastHumanOutboundAt: ago(60) }).offer, true);
});

test("não oferece fora do horário comercial nem com a janela de 24h fechada", () => {
  assert.equal(decideResumeOffer({ ...base, withinBusinessHours: false }).reason, "fora_do_horario");
  assert.equal(decideResumeOffer({ ...base, windowOpen: false }).reason, "janela_fechada");
});

test("parseResumeReply", () => {
  for (const m of ["SIM", "sim!", "Claro", "pode ser", "vamos", "1", "continuar"]) assert.equal(parseResumeReply(m), "yes", m);
  for (const m of ["menu", "MENU", "não", "voltar", "agora não", "2"]) assert.equal(parseResumeReply(m), "menu", m);
  for (const m of ["qual o endereço da clínica?", "quero saber o valor da consulta particular", "", null]) {
    assert.equal(parseResumeReply(m as string), "other", String(m));
  }
});

test("resumeQuestionFor usa o nome da criança e cobre as etapas do AGENDAR", () => {
  assert.match(resumeQuestionFor("awaiting_child_birth_date", { child_name: "Ana Souza" }), /Ana Souza/);
  assert.match(resumeQuestionFor("awaiting_child_birth_date", {}), /a criança/);
  assert.equal(resumeQuestionFor("etapa_desconhecida", {}), "");
});

test("SLA de pending: alerta uma vez, em horário comercial, sem humano", () => {
  const sla = { escalatedAt: ago(40), nowMs: NOW, minutes: 30, lastHumanOutboundAt: null, humanAttending: false, withinBusinessHours: true, alreadyNotified: false };
  assert.equal(shouldAlertPendingSla(sla), true);
  assert.equal(shouldAlertPendingSla({ ...sla, escalatedAt: ago(10) }), false);
  assert.equal(shouldAlertPendingSla({ ...sla, alreadyNotified: true }), false);
  assert.equal(shouldAlertPendingSla({ ...sla, withinBusinessHours: false }), false);
  assert.equal(shouldAlertPendingSla({ ...sla, humanAttending: true }), false);
  assert.equal(shouldAlertPendingSla({ ...sla, lastHumanOutboundAt: ago(5) }), false);
  assert.equal(shouldAlertPendingSla({ ...sla, minutes: 0 }), false);
});
