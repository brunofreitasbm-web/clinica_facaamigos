// tests/expiring-guides-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupExpiringGuides, type ActiveGuide } from "../lib/expiring-guides-pure.ts";

const TODAY = "2026-11-05";
const LIMIT = "2026-11-20";

function guide(over: Partial<ActiveGuide> & { id: string }): ActiveGuide {
  return {
    patientId: "p1",
    patientName: "Isaias",
    insurerName: "IASEP",
    procedureCode: "ABA",
    guideNumber: null,
    sessionsUsed: 0,
    sessionsAuthorized: 4,
    validTo: "2027-03-01",
    ...over,
  };
}

test("guias recém-lançadas (0 usadas) não disparam 'poucas sessões'", () => {
  const out = groupExpiringGuides(
    [guide({ id: "a", sessionsAuthorized: 4 }), guide({ id: "b", sessionsAuthorized: 2 }), guide({ id: "c", sessionsAuthorized: 2 })],
    TODAY,
    LIMIT,
  );
  assert.deepEqual(out, []);
});

test("poucas sessões usa o saldo somado do paciente por procedimento", () => {
  const out = groupExpiringGuides(
    [
      guide({ id: "a", sessionsAuthorized: 20, sessionsUsed: 18 }), // saldo 2
      guide({ id: "b", sessionsAuthorized: 20, sessionsUsed: 0 }), // mesmo procedimento: saldo somado 22
    ],
    TODAY,
    LIMIT,
  );
  assert.deepEqual(out, []);
});

test("saldo somado ≤ 4 com uso agrupa todas as guias do procedimento numa linha por paciente", () => {
  const out = groupExpiringGuides(
    [
      guide({ id: "a", sessionsAuthorized: 8, sessionsUsed: 7 }),
      guide({ id: "b", sessionsAuthorized: 4, sessionsUsed: 1, validTo: "2027-02-01" }),
    ],
    TODAY,
    LIMIT,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].reason, "poucas_sessoes");
  assert.equal(out[0].lowestBalance, 4);
  assert.deepEqual(out[0].guides.map((g) => g.id), ["b", "a"]);
});

test("procedimentos diferentes não somam saldo entre si", () => {
  const out = groupExpiringGuides(
    [
      guide({ id: "a", procedureCode: "ABA", sessionsAuthorized: 10, sessionsUsed: 9 }),
      guide({ id: "b", procedureCode: "FONO", sessionsAuthorized: 40, sessionsUsed: 1 }),
    ],
    TODAY,
    LIMIT,
  );
  assert.deepEqual(out[0].guides.map((g) => g.id), ["a"]);
});

test("vencendo é por guia, pela validade, e pesa mais que poucas sessões", () => {
  const out = groupExpiringGuides(
    [
      guide({ id: "a", sessionsAuthorized: 10, sessionsUsed: 9, validTo: "2027-01-01" }),
      guide({ id: "b", procedureCode: "FONO", validTo: "2026-11-12", sessionsAuthorized: 30 }),
    ],
    TODAY,
    LIMIT,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].reason, "vencendo");
  assert.equal(out[0].nextValidTo, "2026-11-12");
  assert.equal(out[0].guides.length, 2);
});

test("validade fora da janela (já vencida ou além de 15 dias) não conta", () => {
  const out = groupExpiringGuides(
    [guide({ id: "a", validTo: "2026-11-04" }), guide({ id: "b", procedureCode: "X", validTo: "2026-11-21" })],
    TODAY,
    LIMIT,
  );
  assert.deepEqual(out, []);
});

test("ordena vencendo (data mais próxima) antes de poucas sessões (menor saldo)", () => {
  const out = groupExpiringGuides(
    [
      guide({ id: "a", patientId: "p1", sessionsAuthorized: 5, sessionsUsed: 4 }),
      guide({ id: "b", patientId: "p2", validTo: "2026-11-18" }),
      guide({ id: "c", patientId: "p3", validTo: "2026-11-10" }),
      guide({ id: "d", patientId: "p4", sessionsAuthorized: 5, sessionsUsed: 5 }),
    ],
    TODAY,
    LIMIT,
  );
  assert.deepEqual(out.map((g) => g.patientId), ["p3", "p2", "p4", "p1"]);
});
