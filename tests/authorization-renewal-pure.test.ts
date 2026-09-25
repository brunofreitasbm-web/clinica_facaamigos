// tests/authorization-renewal-pure.test.ts
//
// Vigência sugerida e validação da renovação de guia
// (app/recepcao/pacientes/pendencias/authorization-renewal-pure.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestedRenewalPeriod, validateRenewalPeriod } from "../app/recepcao/pacientes/pendencias/authorization-renewal-pure.ts";

test("guia nova começa no dia seguinte e dura o mesmo tanto que a atual", () => {
  assert.deepEqual(suggestedRenewalPeriod("2026-07-01", "2026-09-29"), { validFrom: "2026-09-30", validTo: "2026-12-29" });
  assert.deepEqual(suggestedRenewalPeriod("2026-12-01", "2026-12-31"), { validFrom: "2027-01-01", validTo: "2027-01-31" });
});

test("datas inválidas na guia atual caem em 90 dias", () => {
  const { validFrom, validTo } = suggestedRenewalPeriod("lixo", "2026-09-29");
  assert.equal(validFrom, "2026-09-30");
  assert.equal(validTo, "2026-12-28");
});

test("validação de sessões e vigência", () => {
  assert.equal(validateRenewalPeriod({ sessions: 20, validFrom: "2026-10-01", validTo: "2026-12-31" }), null);
  assert.equal(validateRenewalPeriod({ sessions: 20, validFrom: "2026-10-01", validTo: "2026-10-01" }), null);
  assert.match(validateRenewalPeriod({ sessions: 0, validFrom: "2026-10-01", validTo: "2026-12-31" }) ?? "", /sessões/);
  assert.match(validateRenewalPeriod({ sessions: 2.5, validFrom: "2026-10-01", validTo: "2026-12-31" }) ?? "", /sessões/);
  assert.match(validateRenewalPeriod({ sessions: 20, validFrom: "", validTo: "2026-12-31" }) ?? "", /datas/);
  assert.match(validateRenewalPeriod({ sessions: 20, validFrom: "2026-02-30", validTo: "2026-12-31" }) ?? "", /datas/);
  assert.match(validateRenewalPeriod({ sessions: 20, validFrom: "2026-12-31", validTo: "2026-10-01" }) ?? "", /depois/);
});
