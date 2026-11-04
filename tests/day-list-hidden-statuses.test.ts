import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_LIST_HIDDEN_STATUSES } from "../lib/appointment-cancel-reasons.ts";

test("Agenda do dia esconde canceladas e remarcadas, mas mantém falta e sessões vivas", () => {
  for (const s of ["cancelada_familia", "cancelada_terapeuta", "cancelada_clinica", "remarcada"]) {
    assert.ok(DAY_LIST_HIDDEN_STATUSES.includes(s), s);
  }
  for (const s of ["agendada", "confirmada", "realizada", "falta_familia"]) {
    assert.ok(!DAY_LIST_HIDDEN_STATUSES.includes(s), s);
  }
});
