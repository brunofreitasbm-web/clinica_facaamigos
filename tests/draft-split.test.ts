// tests/draft-split.test.ts
//
// Divisão automática de irmãos num mesmo contato (lib/draft-split.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSiblingExtraction, planSiblings, siblingsToCreate, stripSiblings } from "../lib/draft-split.ts";

const extracted = {
  patient: { full_name: "Arthur Ryan Siqueira Nunes de Farias", birth_date: "2020-12-22", cpf: "09525468259", cid: "F84.0" },
  guardian: { full_name: "Renata Correa Siqueira", phone: "+559182918282" },
  insurance: { insurer_name: "IASEP", insurer_id: "x", card_number: "24569201", card_valid_until: "2027-01-01" },
  authorization: { guide_number: "50426486" },
  documents: [
    { index: 0, kind: "carteirinha", summary: "Arthur" },
    { index: 1, kind: "carteirinha", summary: "Agatha" },
    { index: 2, kind: "documento_identidade", summary: "RG Agatha" },
  ],
  additional_children: [
    { full_name: "Agatha Rylai Siqueira Nunes de Farias", birth_date: "2020-12-22", cpf: null, cid: "6A02", card_number: "24569202", document_indexes: [1, 2] },
  ],
};

test("cria o irmão que ainda não existe", () => {
  const list = siblingsToCreate(extracted, [extracted.patient.full_name]);
  assert.equal(list.length, 1);
  assert.equal(list[0].full_name, "Agatha Rylai Siqueira Nunes de Farias");
});

test("reprocessar não duplica irmão já separado", () => {
  const known = [extracted.patient.full_name, "AGATHA RYLAI SIQUEIRA NUNES DE FARIAS"];
  assert.equal(siblingsToCreate(extracted, known).length, 0);
});

test("nomes parecidos com primeiro nome diferente continuam sendo irmãos distintos", () => {
  const ext = { additional_children: [{ full_name: "Bia Silva Souza", document_indexes: [] }] };
  assert.equal(siblingsToCreate(ext, ["Ana Silva Souza"]).length, 1);
});

test("sem additional_children não divide nada", () => {
  assert.deepEqual(siblingsToCreate({ patient: {} }, []), []);
  assert.deepEqual(siblingsToCreate(null, []), []);
});

test("rascunho do irmão não herda CPF, carteirinha, CID nem guia da outra criança", () => {
  const [sibling] = siblingsToCreate(extracted, []);
  const built = buildSiblingExtraction(extracted, sibling) as any;
  assert.equal(built.patient.cpf, null);
  assert.equal(built.patient.cid, "6A02");
  assert.equal(built.insurance.card_number, "24569202");
  assert.equal(built.insurance.insurer_name, "IASEP");
  assert.deepEqual(built.authorization, {});
  assert.equal(built.guardian.full_name, "Renata Correa Siqueira");
  assert.deepEqual(built.documents.map((d: any) => d.index), [1, 2]);
});

test("arquivos: exclusivos do irmão são movidos; comprovante é copiado", () => {
  const [sibling] = siblingsToCreate(extracted, []);
  const files = [
    { id: "f0", detectedType: "carteirinha" },
    { id: "f1", detectedType: "carteirinha" },
    { id: "f2", detectedType: "documento_identidade" },
    { id: "f3", detectedType: "comprovante_residencia" },
  ];
  const [plan] = planSiblings(extracted, [sibling], files);
  assert.deepEqual(plan.moveFileIds, ["f1", "f2"]);
  assert.deepEqual(plan.copyFileIds, ["f3"]);
});

test("stripSiblings esvazia a lista e avisa a recepção", () => {
  const out = stripSiblings(extracted, 1) as any;
  assert.deepEqual(out.additional_children, []);
  assert.match(out.warnings.at(-1), /separados/);
});
