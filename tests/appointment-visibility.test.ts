import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NON_OCCURRED_STATUSES,
  NON_OCCURRED_IN_FILTER,
  isNonOccurredStatus,
  filterOccurred,
  excludeNonOccurred,
} from "../lib/appointment-visibility.ts";
import { toSessionAuditRow, reasonLabel } from "../lib/session-audit-pure.ts";

test("não ocorridas = 3 canceladas + remarcada; falta e sessões vivas ficam", () => {
  for (const s of ["cancelada_familia", "cancelada_terapeuta", "cancelada_clinica", "remarcada"]) {
    assert.ok(isNonOccurredStatus(s), s);
  }
  for (const s of ["agendada", "confirmada", "realizada", "falta_familia", "aguardando_aprovacao_supervisao"]) {
    assert.ok(!isNonOccurredStatus(s), s);
  }
  assert.equal(NON_OCCURRED_STATUSES.length, 4);
});

test("filtro PostgREST e filterOccurred usam a mesma lista", () => {
  assert.equal(NON_OCCURRED_IN_FILTER, "(cancelada_familia,cancelada_terapeuta,cancelada_clinica,remarcada)");
  const rows = [{ status: "realizada" }, { status: "remarcada" }, { status: "falta_familia" }];
  assert.deepEqual(filterOccurred(rows), [{ status: "realizada" }, { status: "falta_familia" }]);
});

test("excludeNonOccurred chama .not('status','in',...)", () => {
  const calls: unknown[][] = [];
  const q = { not(...a: unknown[]) { calls.push(a); return q; } };
  excludeNonOccurred(q as never);
  assert.deepEqual(calls, [["status", "in", NON_OCCURRED_IN_FILTER]]);
});

test("linha de auditoria traduz status, motivo e tolera relações ausentes", () => {
  const row = toSessionAuditRow({
    id: "1",
    starts_at: "2026-11-03T12:00:00Z",
    status: "cancelada_familia",
    cancel_reason: "transporte",
    cancelled_at: "2026-11-02T10:00:00Z",
    patient: [{ full_name: "Ana" }],
    therapist: { full_name: "Bia" },
    canceller: null,
  });
  assert.equal(row.statusLabel, "Cancelada pela família");
  assert.equal(row.reasonLabel, "Transporte");
  assert.equal(row.patientName, "Ana");
  assert.equal(row.therapistName, "Bia");
  assert.equal(row.cancelledBy, "Não registrado");
  assert.equal(reasonLabel(null), "Sem motivo registrado");
});
