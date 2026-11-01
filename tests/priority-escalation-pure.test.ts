// tests/priority-escalation-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPriorityEscalation,
  priorityLabel,
  prioritizeConversations,
} from "../lib/atendimento/priority-pure.ts";

const base = { status: "pending", escalationReason: "particular_agendar", assignedTo: null };

test("particular_agendar e pediu_humano sem dono são prioridade", () => {
  assert.equal(isPriorityEscalation(base), true);
  assert.equal(isPriorityEscalation({ ...base, escalationReason: "pediu_humano" }), true);
});

test("assumir a conversa (assignedTo) encerra a prioridade", () => {
  assert.equal(isPriorityEscalation({ ...base, assignedTo: "user-1" }), false);
});

test("só conversa pending conta (aberta ou encerrada não)", () => {
  assert.equal(isPriorityEscalation({ ...base, status: "open" }), false);
  assert.equal(isPriorityEscalation({ ...base, status: "closed" }), false);
});

test("outros motivos não são prioridade (inclui 'particular' só de menu)", () => {
  for (const r of ["particular", "fora_da_base", "clinico", "relatorio", "lista_espera", null]) {
    assert.equal(isPriorityEscalation({ ...base, escalationReason: r }), false, String(r));
  }
});

test("rótulo da pílula", () => {
  assert.equal(priorityLabel("particular_agendar"), "Prioridade · Particular");
  assert.equal(priorityLabel("pediu_humano"), "Prioridade · Pediu humano");
});

test("prioridades vão para o topo, mantendo a ordem relativa", () => {
  const rows = [
    { id: "a", ...base, status: "open", escalationReason: null },
    { id: "b", ...base },
    { id: "c", ...base, status: "open", escalationReason: null },
    { id: "d", ...base, escalationReason: "pediu_humano" },
  ];
  assert.deepEqual(prioritizeConversations(rows).map((r) => r.id), ["b", "d", "a", "c"]);
});
