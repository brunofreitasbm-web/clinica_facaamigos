// tests/evaluation-pick-evaluator.test.ts
//
// Alocação automática do avaliador no agendamento manual da 1ª avaliação:
// livre no horário + menos avaliações na semana; empate → menor id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickEvaluatorForSlot, type BusyRange, type OfferTherapist } from "../lib/evaluation-offer-slots-pure.ts";

const MIN = 60_000;
// Segunda 2026-11-02, 09:00–09:50 (minutos 540–590); dow = 1.
const base = { dayOfWeek: 1, startMin: 540, endMin: 590, startMs: 1_000 * MIN, endMs: 1_050 * MIN };

const open = (id: string): OfferTherapist => ({ id, windows: null });
const busyFor = (therapistId: string, startMs: number, endMs: number): BusyRange => ({
  therapistId,
  roomId: null,
  startMs,
  endMs,
  date: "2026-11-02",
  startMin: 540,
});

test("escolhe quem tem menos avaliações na semana", () => {
  const id = pickEvaluatorForSlot({
    ...base,
    therapists: [open("A"), open("B")],
    busy: [],
    weekLoad: new Map([["A", 3], ["B", 1]]),
  });
  assert.equal(id, "B");
});

test("empate de carga → menor id", () => {
  const id = pickEvaluatorForSlot({ ...base, therapists: [open("B"), open("A")], busy: [], weekLoad: new Map() });
  assert.equal(id, "A");
});

test("ignora quem tem atendimento sobreposto", () => {
  const id = pickEvaluatorForSlot({
    ...base,
    therapists: [open("A"), open("B")],
    busy: [busyFor("A", base.startMs + 10 * MIN, base.endMs + 10 * MIN)],
    weekLoad: new Map(),
  });
  assert.equal(id, "B");
});

test("atendimento encostado (termina quando o outro começa) não conflita", () => {
  const id = pickEvaluatorForSlot({
    ...base,
    therapists: [open("A")],
    busy: [busyFor("A", base.startMs - 50 * MIN, base.startMs)],
    weekLoad: new Map(),
  });
  assert.equal(id, "A");
});

test("janela cadastrada que não cobre o horário exclui o avaliador", () => {
  const onlyAfternoon: OfferTherapist = { id: "A", windows: new Map([[1, [[780, 1020]]]]) };
  const id = pickEvaluatorForSlot({ ...base, therapists: [onlyAfternoon, open("B")], busy: [], weekLoad: new Map() });
  assert.equal(id, "B");
});

test("janela cadastrada que cobre o horário vale", () => {
  const morning: OfferTherapist = { id: "A", windows: new Map([[1, [[480, 720]]]]) };
  const id = pickEvaluatorForSlot({ ...base, therapists: [morning], busy: [], weekLoad: new Map() });
  assert.equal(id, "A");
});

test("ninguém livre → null", () => {
  const id = pickEvaluatorForSlot({
    ...base,
    therapists: [open("A")],
    busy: [busyFor("A", base.startMs, base.endMs)],
    weekLoad: new Map(),
  });
  assert.equal(id, null);
});
