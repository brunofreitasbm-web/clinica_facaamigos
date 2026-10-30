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
  // "Nenhum serve": dia novo primeiro; o que sobra do dia já oferecido fica por último.
  assert.deepEqual(page1.map(label), ["2026-11-05 08:00 A", "2026-11-04 15:00 A"]);
});

test("'Nenhum serve' sugere outros dias, um horário por dia, antes de repetir dia já oferecido", () => {
  const all = [
    cand("2026-11-04", "08:00"), cand("2026-11-04", "08:50"), cand("2026-11-04", "09:40"), cand("2026-11-04", "10:30"),
    cand("2026-11-05", "08:00"), cand("2026-11-05", "08:50"),
    cand("2026-11-06", "08:00"),
    cand("2026-11-09", "08:00"),
  ];
  assert.deepEqual(pickOfferPage(all, new Map()).map(label), ["2026-11-04 08:00 A", "2026-11-04 08:50 A", "2026-11-04 09:40 A"]);
  assert.deepEqual(pickOfferPage(all, new Map(), 1).map(label), ["2026-11-05 08:00 A", "2026-11-06 08:00 A", "2026-11-09 08:00 A"]);
  // Dias novos esgotados: voltam outros horários.
  assert.deepEqual(pickOfferPage(all, new Map(), 2).map(label), ["2026-11-04 10:30 A", "2026-11-05 08:50 A"]);
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
    earliestDate: "2026-11-02", // amanhã de NOW (1/11)
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

test("feriado e fechamento parcial somem", () => {
  assert.equal(gen({ days: ["2026-11-20"] }).length, 0); // Consciência Negra
  const closures = [{ date: "2026-11-04", start_minutes: 8 * 60, end_minutes: 12 * 60, reason: "Reunião" }];
  assert.ok(gen({ closures }).every((c) => c.startMin >= 12 * 60));
});

test("data mais próxima: nunca o mesmo dia, o primeiro horário vago é o do dia seguinte", () => {
  // Hoje é 3/11 às 06:00 (segunda... terça): o 1º dia permitido é 4/11, mesmo com a manhã de hoje livre.
  const today = "2026-11-03";
  const tomorrow = "2026-11-04";
  const nowMs = Date.parse("2026-11-03T06:00:00-03:00");
  const c = gen({ days: [today, tomorrow], nowMs, earliestDate: tomorrow });
  assert.ok(c.length > 0);
  assert.ok(c.every((x) => x.date === tomorrow));
  assert.equal(c[0].startMin, 480); // 08:00 de amanhã
});

test("dia permitido mais cedo vazio (feriado) pula para o próximo dia útil", () => {
  // 19/11 é quinta; 20/11 (Consciência Negra) é feriado; o próximo dia útil é 23/11.
  const days = ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"];
  const c = gen({ days, earliestDate: "2026-11-20", nowMs: Date.parse("2026-11-19T10:00:00-03:00") });
  assert.equal(c[0].date, "2026-11-23");
});

test("nunca sugere horário que já passou, mesmo dentro do dia permitido", () => {
  const nowMs = Date.parse("2026-11-04T10:00:00-03:00");
  const c = gen({ days: ["2026-11-04"], nowMs, earliestDate: "2026-11-04" });
  assert.ok(c.every((x) => toUtcMs(x.date, x.startMin) > nowMs));
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
