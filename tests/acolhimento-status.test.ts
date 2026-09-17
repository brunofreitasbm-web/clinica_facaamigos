import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStatuses, type AcolhimentoStatus } from "../lib/acolhimento-requests.ts";

const PARTICULAR_CHAIN: AcolhimentoStatus[] = [
  "solicitado",
  "aguardando_agendamento",
  "agendado",
  "aguardando_pagamento",
  "realizado",
  "contrato_pendente",
  "grade_pendente",
  "concluido",
];

const CONVENIO_CHAIN: AcolhimentoStatus[] = [
  "solicitado",
  "aguardando_agendamento",
  "agendado",
  "realizado",
  "contrato_pendente",
  "grade_pendente",
  "concluido",
];

test("nextStatuses - particular percorre a cadeia com aguardando_pagamento antes de realizado", () => {
  for (let i = 0; i < PARTICULAR_CHAIN.length - 1; i++) {
    const current = PARTICULAR_CHAIN[i];
    const expectedNext = PARTICULAR_CHAIN[i + 1];
    const result = nextStatuses(current, "particular");
    assert.ok(result.includes(expectedNext), `${current} deveria poder ir para ${expectedNext}`);
  }
});

test("nextStatuses - convenio pula aguardando_pagamento e vai direto para realizado", () => {
  for (let i = 0; i < CONVENIO_CHAIN.length - 1; i++) {
    const current = CONVENIO_CHAIN[i];
    const expectedNext = CONVENIO_CHAIN[i + 1];
    const result = nextStatuses(current, "convenio");
    assert.ok(result.includes(expectedNext), `${current} deveria poder ir para ${expectedNext}`);
  }

  // convênio nunca deveria oferecer aguardando_pagamento como próximo passo
  const fromAgendado = nextStatuses("agendado", "convenio");
  assert.ok(!fromAgendado.includes("aguardando_pagamento"));
  assert.ok(fromAgendado.includes("realizado"));
});

test("nextStatuses - concluido e cancelado sao terminais (sem proximo status)", () => {
  assert.deepEqual(nextStatuses("concluido", "particular"), []);
  assert.deepEqual(nextStatuses("concluido", "convenio"), []);
  assert.deepEqual(nextStatuses("cancelado", "particular"), []);
  assert.deepEqual(nextStatuses("cancelado", "convenio"), []);
});

test("nextStatuses - cancelado é alcançável de qualquer status não-terminal, para os dois fundings", () => {
  const nonTerminal: AcolhimentoStatus[] = [
    "solicitado",
    "aguardando_agendamento",
    "agendado",
    "aguardando_pagamento",
    "realizado",
    "contrato_pendente",
    "grade_pendente",
  ];

  for (const status of nonTerminal) {
    for (const funding of ["particular", "convenio"] as const) {
      const result = nextStatuses(status, funding);
      assert.ok(result.includes("cancelado"), `${status}/${funding} deveria poder cancelar`);
    }
  }
});
