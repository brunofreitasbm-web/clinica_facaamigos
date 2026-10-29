// tests/evaluation-offer-slots-pure.test.ts
//
// Ordem de preenchimento de turno dos horários oferecidos ao responsável:
// dia → manhã → tarde, e dentro do turno a avaliadora mais ocupada primeiro.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickOfferPage,
  occupancyKey,
  generateEvaluationCandidates,
  buildOccupancy,
  type BusyRange,
  type OfferCandidate,
  type ShiftOccupancy,
} from "../lib/evaluation-offer-slots-pure.ts";

function cand(date: string, hhmm: string, therapistId = "A", roomId = "R1"): OfferCandidate {
  const [h, m] = hhmm.split(":").map(Number);
  const startMin = h * 60 + m;
  return {
    date,
    startMin,
    endMin: startMin + 50,
    therapistId,
    roomId,
    startsAtIso: `${date}T${hhmm}:00-03:00`,
    endsAtIso: `${date}T${hhmm}:00-03:00`,
  };
}

const label = (c: OfferCandidate) => `${c.date} ${String(Math.floor(c.startMin / 60)).padStart(2, "0")}:${String(c.startMin % 60).padStart(2, "0")} ${c.therapistId}`;

test("completa a manhã, depois a tarde, depois o dia seguinte", () => {
  const all = [
    cand("2026-11-05", "08:00"),
    cand("2026-11-04", "14:00"),
    cand("2026-11-04", "08:50"),
    cand("2026-11-04", "08:00"),
    cand("2026-11-04", "15:00"),
  ];
  const page0 = pickOfferPage(all, new Map());
  assert.deepEqual(page0.map(label), ["2026-11-04 08:00 A", "2026-11-04 08:50 A", "2026-11-04 14:00 A"]);
  const page1 = pickOfferPage(all, new Map(), 1);
  assert.deepEqual(page1.map(label), ["2026-11-04 15:00 A", "2026-11-05 08:00 A"]);
});

test("mesmo turno: avaliadora mais ocupada vem primeiro", () => {
  const occ: ShiftOccupancy = new Map([
    [occupancyKey("B", "2026-11-04", "manha"), 2],
    [occupancyKey("A", "2026-11-04", "manha"), 0],
  ]);
  const all = [cand("2026-11-04", "08:00", "A"), cand("2026-11-04", "09:40", "B")];
  // B já tem 2 na manhã: fecha o turno dela mesmo com horário mais tarde.
  assert.deepEqual(pickOfferPage(all, occ).map(label), ["2026-11-04 09:40 B", "2026-11-04 08:00 A"]);
});

test("empate de ocupação cai no horário mais cedo", () => {
  const all = [cand("2026-11-04", "10:30", "A"), cand("2026-11-04", "09:40", "B")];
  assert.deepEqual(pickOfferPage(all, new Map()).map(label), ["2026-11-04 09:40 B", "2026-11-04 10:30 A"]);
});

test("ocupação da manhã não vaza para a tarde", () => {
  const occ: ShiftOccupancy = new Map([[occupancyKey("B", "2026-11-04", "manha"), 5]]);
  const all = [cand("2026-11-04", "14:00", "A"), cand("2026-11-04", "14:50", "B")];
  assert.deepEqual(pickOfferPage(all, occ).map(label), ["2026-11-04 14:00 A", "2026-11-04 14:50 B"]);
});

const GRADE = [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "08:00:00", close_time: "19:00:00" }));
// -03:00 fixo, sem horário de verão: suficiente pra testar a lógica.
const toUtcMs = (date: string, min: number) =>
  Date.parse(`${date}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00-03:00`);
const NOW = Date.parse("2026-11-01T12:00:00-03:00");

function gen(overrides: Partial<Parameters<typeof generateEvaluationCandidates>[0]> = {}) {
  return generateEvaluationCandidates({
    days: ["2026-11-04"], // quarta, mais de 24h depois de NOW
    therapists: [{ id: "A", windows: null }],
    roomIds: ["R1"],
    busy: [],
    businessHours: GRADE,
    closures: [],
    nowMs: NOW,
    toUtcMs,
    ...overrides,
  });
}

function busyAt(therapistId: string, roomId: string | null, date: string, fromMin: number, toMin: number): BusyRange {
  return { therapistId, roomId, startMs: toUtcMs(date, fromMin), endMs: toUtcMs(date, toMin), date, startMin: fromMin };
}

test("candidatos encostados: 08:00, 08:50, 09:40", () => {
  assert.deepEqual(gen().slice(0, 3).map((c) => c.startMin), [480, 530, 580]);
});

test("retoma logo depois de um atendimento existente", () => {
  assert.equal(gen({ busy: [busyAt("A", "R9", "2026-11-04", 480, 530)] })[0].startMin, 530);
});

test("janela de disponibilidade cadastrada limita os horários", () => {
  const windows = new Map<number, [number, number][]>([[3, [[14 * 60, 16 * 60]]]]); // só quarta 14–16h
  // 14:00 e 14:50 cabem; 15:40 + 50min = 16:30 passa de 16:00.
  assert.deepEqual(gen({ therapists: [{ id: "A", windows }] }).map((c) => c.startMin), [840, 890]);
});

test("janelas cadastradas mas nenhuma no dia = sem horário", () => {
  const windows = new Map<number, [number, number][]>([[2, [[8 * 60, 12 * 60]]]]); // só terça
  assert.equal(gen({ therapists: [{ id: "A", windows }] }).length, 0);
});

test("feriado, fechamento parcial e menos de 24h de antecedência somem", () => {
  assert.equal(gen({ days: ["2026-11-20"] }).length, 0); // Consciência Negra
  const closures = [{ date: "2026-11-04", start_minutes: 8 * 60, end_minutes: 12 * 60, reason: "Reunião" }];
  assert.ok(gen({ closures }).every((c) => c.startMin >= 12 * 60));
  // Agora = 3/11 20:00: o dia 4/11 inteiro está a menos de 24h do primeiro horário útil das 08h (12h) e
  // só os horários depois das 20:00 de 4/11 passariam — que não existem (fecha às 19h).
  assert.equal(gen({ nowMs: Date.parse("2026-11-03T20:00:00-03:00") }).length, 0);
});

test("sala ocupada: usa a outra; sem outra sala, pula pro próximo horário", () => {
  const roomBusy = busyAt("Z", "R1", "2026-11-04", 480, 530);
  assert.equal(gen({ roomIds: ["R1", "R2"], busy: [roomBusy] })[0].roomId, "R2");
  assert.equal(gen({ roomIds: ["R1"], busy: [roomBusy] })[0].startMin, 530);
});

test("ocupação por turno conta só o turno do atendimento", () => {
  const occ = buildOccupancy([busyAt("A", null, "2026-11-04", 480, 530), busyAt("A", null, "2026-11-04", 530, 580), busyAt("A", null, "2026-11-04", 840, 890)]);
  assert.equal(occ.get(occupancyKey("A", "2026-11-04", "manha")), 2);
  assert.equal(occ.get(occupancyKey("A", "2026-11-04", "tarde")), 1);
});

test("menos de 3 devolve o que houver; página além do fim, vazio", () => {
  const all = [cand("2026-11-04", "08:00"), cand("2026-11-04", "08:50")];
  assert.equal(pickOfferPage(all, new Map()).length, 2);
  assert.equal(pickOfferPage(all, new Map(), 1).length, 0);
  assert.equal(pickOfferPage([], new Map()).length, 0);
});
