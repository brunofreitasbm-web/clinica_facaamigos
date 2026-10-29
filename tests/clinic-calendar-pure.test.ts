// tests/clinic-calendar-pure.test.ts
//
// Feriados móveis saem da Páscoa; se a Páscoa estiver errada, Carnaval,
// Sexta-feira Santa e Corpus Christi erram juntos — por isso as datas abaixo
// são conferidas contra o calendário oficial.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  easterSunday,
  brazilHolidays,
  closedReason,
  isClinicOpen,
  type BusinessHourRow,
} from "../lib/clinic-calendar-pure.ts";

const GRADE: BusinessHourRow[] = [
  ...[1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "08:00:00", close_time: "19:00:00" })),
  { day_of_week: 6, open_time: "08:00:00", close_time: "12:00:00" },
];

test("Páscoa 2026 e 2027", () => {
  assert.equal(easterSunday(2026), "2026-04-05");
  assert.equal(easterSunday(2027), "2027-03-28");
});

test("feriados móveis 2027: Carnaval, Sexta Santa e Corpus Christi", () => {
  const byName = new Map(brazilHolidays(2027).map((h) => [h.name, h.date]));
  assert.equal(byName.get("Carnaval (segunda-feira)"), "2027-02-08");
  assert.equal(byName.get("Carnaval (terça-feira)"), "2027-02-09");
  assert.equal(byName.get("Sexta-feira Santa"), "2027-03-26");
  assert.equal(byName.get("Corpus Christi"), "2027-05-27");
});

test("feriados móveis 2026", () => {
  const byName = new Map(brazilHolidays(2026).map((h) => [h.name, h.date]));
  assert.equal(byName.get("Sexta-feira Santa"), "2026-04-03");
  assert.equal(byName.get("Corpus Christi"), "2026-06-04");
});

test("lista do ano tem 13 datas ordenadas", () => {
  const list = brazilHolidays(2026);
  assert.equal(list.length, 13);
  assert.deepEqual(list.map((h) => h.date), [...list.map((h) => h.date)].sort());
});

test("feriado fecha o dia inteiro mesmo dentro do expediente", () => {
  const r = closedReason("2026-11-20", 9 * 60, 9 * 60 + 50, { businessHours: GRADE });
  assert.equal(r?.kind, "feriado");
  assert.equal(r?.label, "Consciência Negra");
});

test("expediente: sexta até 19h, sábado até 12h, domingo fechado", () => {
  const o = { businessHours: GRADE };
  assert.equal(isClinicOpen("2026-10-30", 18 * 60 + 10, 19 * 60, o), true);
  assert.equal(isClinicOpen("2026-10-30", 18 * 60 + 30, 19 * 60 + 20, o), false);
  assert.equal(isClinicOpen("2026-10-31", 11 * 60, 11 * 60 + 50, o), true);
  assert.equal(isClinicOpen("2026-10-31", 11 * 60 + 30, 12 * 60 + 20, o), false);
  assert.equal(isClinicOpen("2026-11-01", 9 * 60, 10 * 60, o), false);
});

test("fechamento parcial só bloqueia a janela que ele cobre", () => {
  const o = {
    businessHours: GRADE,
    closures: [{ date: "2026-10-29", start_minutes: 14 * 60, end_minutes: 18 * 60, reason: "Reunião geral" }],
  };
  assert.equal(isClinicOpen("2026-10-29", 9 * 60, 10 * 60, o), true);
  assert.equal(closedReason("2026-10-29", 15 * 60, 16 * 60, o)?.kind, "fechamento");
  // Encosta no limite sem sobrepor: 18:00 já está liberado.
  assert.equal(isClinicOpen("2026-10-29", 18 * 60, 19 * 60, o), true);
});

test("grade vazia = fechado (não inventa horário)", () => {
  assert.equal(isClinicOpen("2026-10-29", 9 * 60, 10 * 60, { businessHours: [] }), false);
});
