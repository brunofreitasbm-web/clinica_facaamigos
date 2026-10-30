// tests/patient-duplicates-pure.test.ts
//
// Duplicidade de paciente (lib/patient-duplicates-pure.ts): mesmo responsável +
// telefone + nascimento + primeiro nome da criança = mesma criança; irmãos e
// gêmeos nunca se mesclam; fica o cadastro mais avançado no fluxo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collapseByChild,
  firstNameKey,
  isDuplicatePatient,
  pickSurvivor,
  planMerges,
  sameChildName,
  type PatientIdentity,
} from "../lib/patient-duplicates-pure.ts";

function patient(over: Partial<PatientIdentity> & { id: string }): PatientIdentity {
  return {
    fullName: "Sophia Amorim Pastana da Costa",
    birthDate: "2016-07-26",
    status: "interessado",
    createdAt: "2026-10-29T15:00:00Z",
    stage: 1,
    evaluated: false,
    hasActiveEvaluation: false,
    guardianNames: ["Tainara de Amorim Pastana"],
    guardianPhones: ["+559189371732"],
    ...over,
  };
}

test("firstNameKey junta grafias: Sofia/Sophia, João/Joao, Anna/Ana", () => {
  assert.equal(firstNameKey("Sofia Morim"), firstNameKey("Sophia Amorim"));
  assert.equal(firstNameKey("João Silva"), firstNameKey("JOAO silva"));
  assert.equal(firstNameKey("Anna Lima"), firstNameKey("Ana Lima"));
  assert.notEqual(firstNameKey("Agnes Caroline"), firstNameKey("Agda Fernanda"));
});

test("sameChildName: primeiro nome decide, sobrenome em comum não basta", () => {
  assert.equal(sameChildName("Sophia Amorim", "Sophia Amorim Pastana da Costa"), true);
  assert.equal(sameChildName("Agnes Caroline Pinto Machado", "Agda Fernanda Pinto Machado"), false);
  assert.equal(sameChildName("", "Sophia"), false);
});

test("caso Sophia: mesmo responsável, telefone, nascimento e nome => duplicado", () => {
  const a = patient({ id: "a", status: "avaliacao", stage: 2 });
  const b = patient({ id: "b", fullName: "Sophia Amorim pastana da costa", status: "arquivado" });
  assert.equal(isDuplicatePatient(a, b), true);
});

test("gêmeos/irmãos (primeiro nome diferente) nunca são duplicados", () => {
  const a = patient({ id: "a", fullName: "Agnes Caroline Pinto Machado", birthDate: "2018-05-14" });
  const b = patient({ id: "b", fullName: "Agda Fernanda Pinto Machado", birthDate: "2018-05-14" });
  assert.equal(isDuplicatePatient(a, b), false);
});

test("nascimento diferente ou telefone diferente não é duplicado", () => {
  const a = patient({ id: "a" });
  assert.equal(isDuplicatePatient(a, patient({ id: "b", birthDate: "2016-07-27" })), false);
  assert.equal(isDuplicatePatient(a, patient({ id: "b", guardianPhones: ["+559188887777"] })), false);
  assert.equal(isDuplicatePatient(a, patient({ id: "b", birthDate: null })), false);
});

test("telefone com formatação diferente (+55 / sem DDI) ainda casa pelos 8 últimos dígitos", () => {
  const a = patient({ id: "a" });
  const b = patient({ id: "b", guardianPhones: ["(91) 8937-1732"] });
  assert.equal(isDuplicatePatient(a, b), true);
});

test("responsável diferente bloqueia; rótulo neutro 'Responsável' não contradiz", () => {
  const a = patient({ id: "a" });
  assert.equal(isDuplicatePatient(a, patient({ id: "b", guardianNames: ["Marcos Pereira"] })), false);
  assert.equal(isDuplicatePatient(a, patient({ id: "b", guardianNames: ["Responsável"] })), true);
  assert.equal(isDuplicatePatient(a, patient({ id: "b", guardianNames: [] })), true);
});

test("pickSurvivor: o mais avançado no fluxo fica; arquivado nunca vence ativo", () => {
  const interessado = patient({ id: "i", stage: 1 });
  const avaliacao = patient({ id: "v", status: "avaliacao", stage: 2 });
  const autorizado = patient({ id: "x", status: "avaliacao", stage: 4 });
  const arquivadoAdiantado = patient({ id: "z", status: "arquivado", stage: 5 });
  assert.equal(pickSurvivor([interessado, avaliacao]).id, "v");
  assert.equal(pickSurvivor([interessado, avaliacao, autorizado]).id, "x");
  assert.equal(pickSurvivor([arquivadoAdiantado, interessado]).id, "i");
});

test("pickSurvivor: empate de estágio vai para o cadastro mais antigo", () => {
  const novo = patient({ id: "n", createdAt: "2026-10-30T10:00:00Z" });
  const velho = patient({ id: "o", createdAt: "2026-10-01T10:00:00Z" });
  assert.equal(pickSurvivor([novo, velho]).id, "o");
});

test("planMerges: três cópias viram um grupo; irmão fica de fora", () => {
  const a = patient({ id: "a", stage: 1 });
  const b = patient({ id: "b", stage: 2, status: "avaliacao" });
  const c = patient({ id: "c", stage: 1, fullName: "Sofia Amorim" });
  const irma = patient({ id: "irma", fullName: "Alice Amorim Pastana da Costa" });
  const plan = planMerges([a, b, c, irma]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].keep.id, "b");
  assert.deepEqual(plan[0].drop.map((p) => p.id).sort(), ["a", "c"]);
});

test("collapseByChild: mesma criança em 3 origens vira 1 card (o de maior score); irmão e sem telefone ficam", () => {
  type Item = { id: string; name: string; phone: string | null; score: number };
  const items: Item[] = [
    { id: "anamnese", name: "Sophia Amorim pastana da costa", phone: "+559189371732", score: 0 },
    { id: "intake", name: "SOFIA MORIM", phone: "(91) 8937-1732", score: 2 },
    { id: "presencial", name: "Sophia Amorim", phone: "+559189371732", score: 7 },
    { id: "irma", name: "Alice Amorim", phone: "+559189371732", score: 2 },
    { id: "semfone", name: "Sophia Amorim", phone: null, score: 0 },
  ];
  const out = collapseByChild(items, (i) => ({ name: i.name, phone: i.phone, score: i.score }));
  assert.deepEqual(out.map((i) => i.id), ["presencial", "irma", "semfone"].sort((a, b) => items.findIndex((i) => i.id === a) - items.findIndex((i) => i.id === b)));
  assert.equal(out.length, 3);
});
