// tests/insurance-intake-nau-parser.test.ts
// Linhas SINTÉTICAS no layout "CONTROLE DE AGENDAMENTOS — NAU/PORTO TERAPIAS"
// (texto linearizado do unpdf). Nenhum dado real de paciente.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNauRows } from "../lib/insurance-intake-nau-parser.ts";

const TEXT = [
  "CONTROLE DE AGENDAMENTOS",
  "SEQ. TERAPIAS CLIENTE DATA DE NASC./IDADE CONTATO GUIA SENHA CÓD. CARTÃO",
  "1 FONOAUDIOLOGIA MARIA DE TESTE SILVA 24/04/2018 – 8 anos (91) 98000-1111 100000001 200000001 880100000000001",
  "2 JOAO DE TESTE COSTA E SILVA 13/02/2015 – 11 anos (91) 99000-2222 100000002 200000002 880100000000002",
  "3 FONOAUDIOLOGIA – ABA e PSICOPEDAGOGIA ANA TESTE LIMA 13/08/2014 – 11 anos (91) 98000-3333 100000003 200000003 880100000000003",
  "4 TERAPIA OCUPACIONAL PEDRO TESTE SANTOS 03/06/2016 – 10 anos (91) 98000-4444 100000004 200000004 880100000000004",
  "5 LUIZA TESTE PRIANTE 28/03/2017 – 9 anos 100000005 200000005 880100000000005",
  "7 CARLOS TESTE ALVES 01/02/2018 – 8 anos (91) 98000-5555 100000007 200000007 8650099366192103",
  "Página 1",
].join("\n");

test("extrai guia, senha e cartão nas colunas certas", () => {
  const { rows } = parseNauRows(TEXT);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    { name: rows[0].name, birth: rows[0].birthDate, guide: rows[0].guide, password: rows[0].password, card: rows[0].card, phone: rows[0].phone },
    { name: "MARIA DE TESTE SILVA", birth: "24/04/2018", guide: "100000001", password: "200000001", card: "880100000000001", phone: "(91) 98000-1111" },
  );
});

test("separa terapias do nome sem engolir o 'E' do sobrenome", () => {
  const { rows } = parseNauRows(TEXT);
  assert.deepEqual(rows[0].therapies, ["FONOAUDIOLOGIA"]);
  assert.equal(rows[1].name, "JOAO DE TESTE COSTA E SILVA");
  assert.deepEqual(rows[1].therapies, []);
  assert.deepEqual(rows[2].therapies, ["FONOAUDIOLOGIA – ABA", "PSICOPEDAGOGIA"]);
  assert.equal(rows[2].name, "ANA TESTE LIMA");
  assert.deepEqual(rows[3].therapies, ["TERAPIA OCUPACIONAL"]);
});

test("telefone ausente vira null e cartão de 16 dígitos é aceito", () => {
  const { rows } = parseNauRows(TEXT);
  assert.equal(rows[4].phone, null);
  assert.equal(rows[5].card, "8650099366192103");
});

test("acusa lacuna na numeração (linha possivelmente perdida)", () => {
  assert.deepEqual(parseNauRows(TEXT).missingSeqs, [6]);
});

test("texto de outro layout não gera linhas", () => {
  assert.deepEqual(parseNauRows("Guia TISS 123456789\nPaciente: Fulano").rows, []);
});
