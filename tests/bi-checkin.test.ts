// tests/bi-checkin.test.ts
// Regra do BI: paciente = quem fez check-in na recepção; o resto é lead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPatientCheckinIndex, patientDedupeKey, isInPeriod } from "../lib/bi-checkin.ts";

const EXCLUDED = ["cancelada_familia", "cancelada_terapeuta", "cancelada_clinica", "remarcada"];

test("só quem tem check-in entra em checkedInIds; agendado sem check-in é lead agendado", () => {
  const idx = buildPatientCheckinIndex(
    [
      { patient_id: "a", status: "realizada", checkin_at: "2026-11-06T12:00:00Z" },
      { patient_id: "b", status: "confirmada", checkin_at: null },
      { patient_id: "c", status: "cancelada_clinica", checkin_at: null },
      { patient_id: "d", status: "agendada", checkin_at: "2026-11-09T16:00:00Z" },
    ],
    EXCLUDED,
  );
  assert.deepEqual([...idx.checkedInIds].sort(), ["a", "d"]);
  assert.ok(!idx.checkedInIds.has("b"));
  assert.ok(idx.scheduledIds.has("b"));
  assert.ok(!idx.scheduledIds.has("c"), "agendamento cancelado não conta como agendado");
});

test("check-in com sessão sem fechamento (status agendada/confirmada) já conta como paciente", () => {
  const idx = buildPatientCheckinIndex(
    [{ patient_id: "x", status: "agendada", checkin_at: "2026-11-09T16:00:00Z" }],
    EXCLUDED,
  );
  assert.ok(idx.checkedInIds.has("x"));
});

test("firstCheckinAt guarda o check-in mais antigo", () => {
  const idx = buildPatientCheckinIndex(
    [
      { patient_id: "a", status: "realizada", checkin_at: "2026-11-10T12:00:00Z" },
      { patient_id: "a", status: "realizada", checkin_at: "2026-11-03T12:00:00Z" },
    ],
    EXCLUDED,
  );
  assert.equal(idx.firstCheckinAt.get("a"), "2026-11-03T12:00:00Z");
});

test("linhas sem patient_id são ignoradas", () => {
  const idx = buildPatientCheckinIndex([{ patient_id: null, status: "realizada", checkin_at: "2026-11-03T12:00:00Z" }], EXCLUDED);
  assert.equal(idx.checkedInIds.size, 0);
});

test("patientDedupeKey junta cadastros duplicados (caixa, acento e espaços)", () => {
  assert.equal(
    patientDedupeKey("Sophia  Rafaely Bezerra Freire", "2009-11-16"),
    patientDedupeKey("sophia rafaely bezerra freire ", "2009-11-16"),
  );
  assert.notEqual(patientDedupeKey("Ana", "2020-01-01"), patientDedupeKey("Ana", "2020-01-02"));
});

test("isInPeriod usa intervalo [início, fim)", () => {
  assert.ok(isInPeriod("2026-11-01T03:00:00Z", "2026-11-01T03:00:00Z", "2026-12-01T03:00:00Z"));
  assert.ok(!isInPeriod("2026-12-01T03:00:00Z", "2026-11-01T03:00:00Z", "2026-12-01T03:00:00Z"));
  assert.ok(!isInPeriod(null, "2026-11-01T03:00:00Z", "2026-12-01T03:00:00Z"));
});
