import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergePills,
  pillForQueueCategory,
  pillsFromLeadPendencies,
  registrationPills,
} from "../lib/patient-pills-pure.ts";

const keys = (pills: { key: string }[]) => pills.map((p) => p.key);

test("convênio sem documentos nem e-mail: RG, laudo, carteirinha e e-mail", () => {
  const pills = registrationPills({ docCategories: [], guardianEmails: [null, ""], insurancePrivateFlags: [false] });
  assert.deepEqual(keys(pills), ["rg", "laudo", "carteirinha", "email"]);
});

test("particular não cobra laudo nem carteirinha", () => {
  const pills = registrationPills({ docCategories: [], guardianEmails: ["a@b.com"], insurancePrivateFlags: [true] });
  assert.deepEqual(keys(pills), ["rg"]);
});

test("sem convênio cadastrado: não cobra laudo nem carteirinha", () => {
  const pills = registrationPills({ docCategories: ["documento_identidade"], guardianEmails: ["a@b.com"], insurancePrivateFlags: [] });
  assert.deepEqual(keys(pills), []);
});

test("pedido médico resolve a pendência de laudo", () => {
  const pills = registrationPills({
    docCategories: ["documento_identidade", "pedido_medico", "carteirinha"],
    guardianEmails: ["a@b.com"],
    insurancePrivateFlags: [false],
  });
  assert.deepEqual(keys(pills), []);
});

test("contato pendente: só faltando vira pílula, e só as quatro pedidas", () => {
  const pills = pillsFromLeadPendencies([
    { key: "doc_responsavel", state: "faltando" },
    { key: "laudo", state: "aviso" },
    { key: "carteirinha", state: "analisando" },
    { key: "email", state: "faltando" },
    { key: "cpf", state: "faltando" },
  ]);
  assert.deepEqual(keys(pills), ["rg", "email"]);
});

test("categorias da fila: só as da recepção com paciente têm pílula", () => {
  assert.equal(pillForQueueCategory("falta_sem_motivo")?.tone, "urgent");
  assert.equal(pillForQueueCategory("remarcacao_solicitada")?.tone, "progress");
  for (const c of ["evolucao_atrasada", "chegada_nao_confirmada", "cadastro_incompleto", "interessado_sem_retorno"]) {
    assert.equal(pillForQueueCategory(c), null, c);
  }
});

test("mergePills tira repetidas e ordena urgente, falta, andamento", () => {
  const rg = registrationPills({ docCategories: [], guardianEmails: ["x@y.z"], insurancePrivateFlags: [true] });
  const merged = mergePills(
    [pillForQueueCategory("renovacao_solicitada")!],
    rg,
    [pillForQueueCategory("falta_sem_motivo")!],
    rg,
  );
  assert.deepEqual(keys(merged), ["falta_sem_motivo", "rg", "renovacao_solicitada"]);
});
