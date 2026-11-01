// tests/particular-plans-pure.test.ts
//
// Catálogo global de planos particulares: o valor do pacote é o mesmo para o bot,
// a IA e o faturamento (contratos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENCONTRO_PLAN_CODE, billingModeForPlan, parsePlanRows, sessionsFromNote, type PlanRow } from "../lib/particular-plans-pure.ts";

const note = (n: number) => `${n} sessões/mês; terapias combináveis; avaliação inicial conta como 1 sessão; bloco ABA = 3 sessões`;
const row = (code: string, name: string, price: number, sessions: number, extra: Partial<PlanRow> = {}): PlanRow => ({
  procedure_code: code,
  procedure_name: name,
  price,
  valid_from: "2026-10-31",
  valid_to: null,
  session_frequency_note: note(sessions),
  ...extra,
});

test("sessionsFromNote lê o número de sessões do início da observação", () => {
  assert.equal(sessionsFromNote("8 sessões/mês; terapias combináveis"), 8);
  assert.equal(sessionsFromNote("1 sessão/mês; avaliação"), 1);
  assert.equal(sessionsFromNote("Valor fechado, fora dos planos mensais"), 0);
  assert.equal(sessionsFromNote(null), 0);
});

test("parsePlanRows: só planos vigentes, ordenados por sessões, sem linhas por terapia nem avaliação", () => {
  const plans = parsePlanRows(
    [
      row("PART-PLANO-LACO", "Plano Laço", 1400, 8),
      row("PART-PLANO-ENCONTRO", "Plano Encontro (sessão avulsa)", 190, 1),
      row("PART-PLANO-VOO-LIVRE", "Plano Voo Livre", 3640, 24),
      // por terapia (faturamento por sessão) e avaliação neuropsicológica: fora do catálogo
      { ...row("PART-FONO-ABA", "Fonoaudiologia ABA", 190, 1), session_frequency_note: "Sessão avulsa particular" },
      { ...row("PART-AVAL-NEURO", "Avaliação Neuropsicológica", 2500, 0), session_frequency_note: "Valor fechado, fora dos planos mensais" },
      // vigência encerrada
      row("PART-PLANO-TURMA", "Plano Turma", 2000, 16, { valid_to: "2026-10-30" }),
      // ainda não vigente
      row("PART-PLANO-ABRACO", "Plano Abraço", 3120, 20, { valid_from: "2026-12-01" }),
    ],
    "2026-11-05",
  );
  assert.deepEqual(
    plans.map((p) => [p.name, p.sessions, p.price]),
    [
      ["Encontro (sessão avulsa)", 1, 190],
      ["Laço", 8, 1400],
      ["Voo Livre", 24, 3640],
    ],
  );
});

test("o valor do pacote não depende da terapia: um preço por plano", () => {
  const plans = parsePlanRows(
    [row("PART-PLANO-LACO", "Plano Laço", 1400, 8), row("PART-PLANO-LACO", "Plano Laço", 1400, 8, { valid_from: "2026-09-01", valid_to: "2026-10-30" })],
    "2026-11-05",
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].price, 1400);
});

test("cobrança: Encontro é por sessão (avulsa); os demais, mensalidade do pacote", () => {
  assert.equal(billingModeForPlan({ code: ENCONTRO_PLAN_CODE }), "avulsa");
  assert.equal(billingModeForPlan({ code: "PART-PLANO-LACO" }), "pacote");
  assert.equal(billingModeForPlan({ code: "PART-PLANO-VOO-LIVRE" }), "pacote");
});
