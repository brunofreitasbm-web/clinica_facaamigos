// tests/agenda-trail.test.ts
// Rastro do dia: sessões distintas do mesmo paciente não podem parecer um
// único agendamento com status contraditório.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrailEvents } from "../lib/agenda-trail.ts";

const TZ = "America/Belem";
const label = (s: string) => (s.startsWith("cancelada") ? "Cancelada" : s);

test("cancelamento de uma sessão cita o horário dela, não o da ativa", () => {
  const events = buildTrailEvents(
    [
      { patientName: "Pietro", status: "confirmada", startsAt: "2026-11-06T19:00:00Z", confirmedAt: null, checkinAt: "2026-11-06T18:31:11Z", checkoutAt: null, cancelledAt: null },
      { patientName: "Pietro", status: "cancelada_clinica", startsAt: "2026-11-06T20:00:00Z", confirmedAt: null, checkinAt: null, checkoutAt: null, cancelledAt: "2026-11-06T18:37:38Z" },
    ],
    label,
    TZ,
  );
  assert.equal(events.length, 2);
  assert.match(events[0].msg, /Cancelada \(sessão das 17:00\)/);
  assert.match(events[1].msg, /Check-in de Pietro \(sessão das 16:00\)/);
});
