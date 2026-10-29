// tests/evaluation-offer-wave-pure.test.ts
//
// A 1ª onda é uma exceção com data piso (06/11/2026): antes dela nada é sugerido,
// depois ela some sozinha. O disparo só acontece em dia útil, em horário comercial
// e com a clínica aberta; quem já teve oferta ou avaliação não entra de novo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canDispatchNow, effectiveEarliestDate, selectWaveCandidates } from "../lib/evaluation-offer-wave-pure.ts";

const GRADE = [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "08:00:00", close_time: "19:00:00" }));

test("piso da onda vale enquanto for depois de amanhã", () => {
  assert.equal(effectiveEarliestDate("2026-10-30", "2026-11-06"), "2026-11-06");
  assert.equal(effectiveEarliestDate("2026-11-06", "2026-11-06"), "2026-11-06");
});

test("depois do piso a exceção some sozinha", () => {
  assert.equal(effectiveEarliestDate("2026-11-09", "2026-11-06"), "2026-11-09");
});

test("sem piso ou piso inválido: amanhã", () => {
  assert.equal(effectiveEarliestDate("2026-10-30", null), "2026-10-30");
  assert.equal(effectiveEarliestDate("2026-10-30", undefined), "2026-10-30");
  assert.equal(effectiveEarliestDate("2026-10-30", "06/11/2026"), "2026-10-30");
});

function at(date: string, weekday: number, hhmm: string, closures: { date: string; start_minutes: number | null; end_minutes: number | null; reason: string }[] = []) {
  const [h, m] = hhmm.split(":").map(Number);
  return canDispatchNow({ date, minutes: h * 60 + m, weekday, businessHours: GRADE, closures });
}

test("disparo: terça 10h pode", () => {
  assert.deepEqual(at("2026-11-03", 2, "10:00"), { ok: true });
  assert.deepEqual(at("2026-11-03", 2, "08:00"), { ok: true });
  assert.deepEqual(at("2026-11-03", 2, "17:59"), { ok: true });
});

test("disparo: nunca de noite, de madrugada ou depois das 18h", () => {
  assert.equal(at("2026-11-03", 2, "07:59").ok, false);
  assert.equal(at("2026-11-03", 2, "18:00").ok, false);
  assert.equal(at("2026-11-03", 2, "21:30").ok, false);
});

test("disparo: nunca no fim de semana", () => {
  const sat = at("2026-10-31", 6, "10:00");
  assert.equal(sat.ok, false);
  assert.equal(at("2026-11-01", 0, "10:00").ok, false);
});

test("disparo: feriado (Finados 02/11) e fechamento cadastrado bloqueiam o dia", () => {
  const finados = at("2026-11-02", 1, "10:00");
  assert.equal(finados.ok, false);
  if (!finados.ok) assert.equal(finados.reason, "Finados");
  const closure = [{ date: "2026-11-04", start_minutes: null, end_minutes: null, reason: "Recesso" }];
  assert.equal(at("2026-11-04", 3, "10:00", closure).ok, false);
});

test("elegíveis: tira quem tem avaliação, oferta ou fluxo do convênio; sem duplicar", () => {
  const authorized = [
    { patientId: "c", patientName: "Carla" },
    { patientId: "a", patientName: "Ana" },
    { patientId: "a", patientName: "Ana" },
    { patientId: "b", patientName: "Bia" },
    { patientId: "d", patientName: "Davi" },
    { patientId: "e", patientName: "Eva" },
  ];
  const out = selectWaveCandidates({
    authorized,
    withEvaluation: new Set(["b"]),
    withOffer: new Set(["d"]),
    withActiveIntakeLead: new Set(["e"]),
  });
  assert.deepEqual(out.map((c) => c.patientId), ["a", "c"]);
});

test("ordem por nome, com acento", () => {
  const out = selectWaveCandidates({
    authorized: [
      { patientId: "1", patientName: "Zélia" },
      { patientId: "2", patientName: "Álvaro" },
    ],
    withEvaluation: new Set(),
    withOffer: new Set(),
    withActiveIntakeLead: new Set(),
  });
  assert.deepEqual(out.map((c) => c.patientName), ["Álvaro", "Zélia"]);
});
