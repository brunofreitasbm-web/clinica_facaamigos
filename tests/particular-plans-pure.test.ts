// tests/particular-plans-pure.test.ts
//
// Catálogo global de planos particulares: o valor do pacote é o mesmo para o bot,
// a IA e o faturamento (contratos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildParticularPricesText, lowestPricePerSession } from "../lib/welcome-menu-pure.ts";
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

// ---------------------------------------------------------------------------
// Plano "6 sessões/mês" (R$ 1.080): nasce DORMENTE (valid_from sentinela 2099-01-01).
// ---------------------------------------------------------------------------
const SEED = [
  row("PART-PLANO-ENCONTRO", "Plano Encontro (sessão avulsa)", 190, 1),
  row("PART-PLANO-PRIMEIRO-PASSO", "Plano Primeiro Passo", 720, 4),
  row("PART-PLANO-LACO", "Plano Laço", 1400, 8),
  row("PART-PLANO-VINCULO", "Plano Vínculo", 1990, 12),
  row("PART-PLANO-TURMA", "Plano Turma", 2580, 16),
  row("PART-PLANO-ABRACO", "Plano Abraço", 3120, 20),
  row("PART-PLANO-VOO-LIVRE", "Plano Voo Livre", 3640, 24),
];
const SIX = (extra: Partial<PlanRow> = {}) => row("PART-PLANO-PASSO-FIRME", "Plano Passo Firme", 1080, 6, extra);
const TODAY = "2026-11-05";
const sessionsList = (plans: ReturnType<typeof parsePlanRows>) => plans.map((p) => p.sessions);

test("plano de 6 sessões dormente (valid_from 2099): catálogo idêntico ao atual", () => {
  const before = parsePlanRows(SEED, TODAY);
  const withDormant = parsePlanRows([...SEED, SIX({ valid_from: "2099-01-01" })], TODAY);
  assert.deepEqual(withDormant, before);
  assert.deepEqual(sessionsList(withDormant), [1, 4, 8, 12, 16, 20, 24]);
  assert.ok(!withDormant.some((p) => p.code === "PART-PLANO-PASSO-FIRME"));
});

test("plano de 6 sessões ativo: aparece entre 4 e 8 sessões, com R$ 1.080", () => {
  const plans = parsePlanRows([...SEED, SIX({ valid_from: "2026-11-05" })], TODAY);
  assert.deepEqual(sessionsList(plans), [1, 4, 6, 8, 12, 16, 20, 24]);
  const six = plans.find((p) => p.sessions === 6)!;
  assert.equal(six.price, 1080);
  assert.equal(six.name, "Passo Firme");
  // a ordem independe da ordem das linhas vindas do banco
  assert.deepEqual(sessionsList(parsePlanRows([SIX({ valid_from: "2026-11-05" }), ...SEED].reverse(), TODAY)), [1, 4, 6, 8, 12, 16, 20, 24]);
});

test("plano de 6 sessões: cobrança é a mensalidade do pacote", () => {
  assert.equal(billingModeForPlan({ code: "PART-PLANO-PASSO-FIRME" }), "pacote");
});

test("plano de 6 sessões ativo não altera o menor valor por sessão nem estoura o texto do WhatsApp", () => {
  const plans = parsePlanRows([...SEED, SIX({ valid_from: "2026-11-05" })], TODAY).map((p) => ({ name: p.name, sessions: p.sessions, price: p.price }));
  assert.equal(Math.round(lowestPricePerSession(plans) * 100) / 100, 151.67);
  const text = buildParticularPricesText(plans);
  assert.match(text, /Passo Firme\* · 6 sessões\/mês: R\$ 1\.080/);
  assert.ok(text.length < 1600);
  // dormente: o texto não menciona o plano
  const dormant = parsePlanRows([...SEED, SIX({ valid_from: "2099-01-01" })], TODAY).map((p) => ({ name: p.name, sessions: p.sessions, price: p.price }));
  assert.ok(!buildParticularPricesText(dormant).includes("1.080"));
});

test("migration do plano de 6 sessões: dormente, R$ 1.080, 6 sessões e idempotente", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261105170000_particular_plan_6_sessoes_standby.sql", import.meta.url), "utf8");
  const insert = sql.slice(sql.indexOf("insert into"));
  assert.match(insert, /'PART-PLANO-PASSO-FIRME'/);
  assert.match(insert, /1080\.00/);
  assert.match(insert, /date '2099-01-01'/);
  assert.match(insert, /not exists/);
  const note = /'(6 sess[^']*)'/.exec(insert)?.[1];
  assert.equal(sessionsFromNote(note), 6);
  // a linha, como o banco a devolveria, é ignorada hoje e entra após a ativação
  const dormant = SIX({ valid_from: "2099-01-01", session_frequency_note: note ?? null });
  assert.deepEqual(parsePlanRows([dormant], TODAY), []);
  assert.equal(parsePlanRows([{ ...dormant, valid_from: TODAY }], TODAY).length, 1);
});
