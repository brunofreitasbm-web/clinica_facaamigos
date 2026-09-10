// tests/remittance-parser.test.ts
//
// Cobre lib/insurance-remittance-parser.ts, o reconhecimento das notas dos
// planos de saúde que alimenta os recebíveis da DRE. O que está testado aqui é
// exatamente o que, se quebrar, entra errado como dinheiro na DRE: qual coluna
// é "glosado" e qual é "liberado", valor em formato brasileiro, linha de TOTAL
// que não pode virar recebível e o cálculo do líquido quando o arquivo só traz
// o apresentado.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMoney,
  mapHeaders,
  looksLikeHeader,
  isSummaryRow,
  parseCsvRows,
  parseRemittanceFile,
  scanHeaderFields,
  assignToColumns,
  rowFromCells,
  type Cell,
} from "../lib/insurance-remittance-parser.ts";

test("valor em formato brasileiro, americano e com ruído", () => {
  assert.equal(parseMoney("1.234,56"), 1234.56);
  assert.equal(parseMoney("R$ 89,90"), 89.9);
  assert.equal(parseMoney("1234.56"), 1234.56);
  assert.equal(parseMoney("-150,00"), -150);
  assert.equal(parseMoney("(150,00)"), -150);
  assert.equal(parseMoney(1234.56), 1234.56);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("—"), null);
  assert.equal(parseMoney("MARIA DA SILVA"), null);
});

test("'valor glosado' não é confundido com o 'valor' genérico", () => {
  const mapping = mapHeaders(["Guia", "Beneficiário", "Valor Apresentado", "Valor Glosado", "Valor Liberado"]);
  assert.equal(mapping.get(0), "guide_number");
  assert.equal(mapping.get(1), "patient_name");
  assert.equal(mapping.get(2), "gross_amount");
  assert.equal(mapping.get(3), "glosa_amount");
  assert.equal(mapping.get(4), "net_amount");
});

test("cabeçalho exige coluna de valor E coluna de identificação", () => {
  assert.equal(looksLikeHeader(["Guia", "Beneficiário", "Valor Liberado"]), true);
  assert.equal(looksLikeHeader(["Guia", "Beneficiário", "Senha"]), false);
  assert.equal(looksLikeHeader(["Valor Apresentado", "Valor Liberado"]), false);
  assert.equal(looksLikeHeader(["DEMONSTRATIVO DE PAGAMENTO — UNIMED"]), false);
});

test("linha de fechamento nunca vira recebível", () => {
  assert.equal(isSummaryRow(["TOTAL", "", "1.800,00"]), true);
  assert.equal(isSummaryRow(["Subtotal do lote", "600,00"]), true);
  assert.equal(isSummaryRow(["1234567", "MARIA DA SILVA", "600,00"]), false);
});

test("CSV com aspas e ponto-e-vírgula", () => {
  const rows = parseCsvRows('a;b;c\n"SILVA; MARIA";2;"diz ""oi"""\n');
  assert.deepEqual(rows[0], ["a", "b", "c"]);
  assert.deepEqual(rows[1], ["SILVA; MARIA", "2", 'diz "oi"']);
});

const CSV_NOTA = [
  "Numero da Guia;Beneficiario;Codigo TUSS;Qtde;Data Atendimento;Valor Apresentado;Valor Glosado;Valor Liberado",
  "1234567;MARIA DA SILVA;50000462;8;05/08/2026;1.200,00;150,00;1.050,00",
  "1234568;JOAO PEREIRA;50000462;4;06/08/2026;600,00;0,00;600,00",
  "TOTAL;;;;;1.800,00;150,00;1.650,00",
  "",
].join("\n");

test("nota em CSV: linhas, totais, convênio e competência", async () => {
  const outcome = await parseRemittanceFile({ name: "nota_unimed_2026-08.csv", bytes: Buffer.from(CSV_NOTA, "utf8") });
  assert.equal(outcome.success, true);
  if (!outcome.success) return;

  const { result } = outcome;
  assert.equal(result.lines.length, 2, "a linha de TOTAL não pode entrar");
  assert.deepEqual(result.totals, { gross: 1800, glosa: 150, net: 1650 });
  assert.equal(result.detectedInsurer, "Unimed");
  assert.equal(result.competenceMonth, "2026-08");

  const [primeira] = result.lines;
  assert.equal(primeira!.guideNumber, "1234567");
  assert.equal(primeira!.patientName, "MARIA DA SILVA");
  assert.equal(primeira!.sessions, 8);
  assert.equal(primeira!.grossAmount, 1200);
  assert.equal(primeira!.glosaAmount, 150);
  assert.equal(primeira!.netAmount, 1050);
  assert.equal(primeira!.serviceDate, "2026-08-05");
  assert.equal(primeira!.lowConfidence, false);
});

test("nota sem coluna de liberado: líquido = apresentado − glosa", async () => {
  const csv = ["Guia;Paciente;Valor Apresentado;Valor Glosado", "999;ANA LIMA;1.000,00;250,00", ""].join("\n");
  const outcome = await parseRemittanceFile({ name: "nota.csv", bytes: Buffer.from(csv, "utf8") }, { competenceMonth: "2026-08" });
  assert.equal(outcome.success, true);
  if (!outcome.success) return;
  assert.equal(outcome.result.lines[0]!.netAmount, 750);
  assert.equal(outcome.result.totals.net, 750);
});

test("competência escolhida na tela vence a detectada no arquivo", async () => {
  const outcome = await parseRemittanceFile(
    { name: "nota_unimed_2026-08.csv", bytes: Buffer.from(CSV_NOTA, "utf8") },
    { competenceMonth: "2026-07", insurerName: "Amil" },
  );
  assert.equal(outcome.success, true);
  if (!outcome.success) return;
  assert.equal(outcome.result.competenceMonth, "2026-07");
  assert.equal(outcome.result.detectedInsurer, "Amil");
});

test("arquivo sem cabeçalho reconhecível avisa e não inventa linha", async () => {
  const csv = "coluna a;coluna b\n1;2\n";
  const outcome = await parseRemittanceFile({ name: "qualquer.csv", bytes: Buffer.from(csv, "utf8") });
  assert.equal(outcome.success, true);
  if (!outcome.success) return;
  assert.equal(outcome.result.lines.length, 0);
  assert.ok(outcome.result.warnings.some((warning) => warning.includes("cabeçalho não reconhecido") || warning.includes("cabeçalho")));
});

test("formato não suportado e arquivo vazio são recusados", async () => {
  const semSuporte = await parseRemittanceFile({ name: "nota.docx", bytes: Buffer.from("x") });
  assert.equal(semSuporte.success, false);
  const vazio = await parseRemittanceFile({ name: "nota.csv", bytes: Buffer.alloc(0) });
  assert.equal(vazio.success, false);
});

// --- reconhecimento de coluna em PDF -----------------------------------------
// Os dois casos abaixo saíram de PDFs reais gerados para teste e são exatamente
// onde o reconhecimento por texto corrido erra: o pdf.js entrega rótulos de
// colunas vizinhas colados num item só, e coluna de dinheiro alinhada à direita
// põe o valor bem longe da borda esquerda do rótulo.

function cell(text: string, x: number, width: number): Cell {
  return { text, x, right: x + width };
}

test("cabeçalho com rótulos colados num item só ainda separa as colunas", () => {
  const header = [
    cell("Numero da Guia", 24, 62),
    cell("Beneficiario", 94, 46),
    cell("Codigo TUSS", 224, 50),
    cell("Qtde", 284, 18),
    cell("Data Atendimento Valor ApresentadoValor Glosado", 319, 194),
    cell("Valor Liberado", 519, 56),
  ];
  const columns = scanHeaderFields(header);
  assert.deepEqual(
    columns.map((column) => column.field),
    ["guide_number", "patient_name", "procedure_code", "sessions", "service_date", "gross_amount", "glosa_amount", "net_amount"],
  );

  const row = [
    cell("1234567", 24, 31), cell("MARIA DA SILVA", 94, 62), cell("50000462", 224, 36), cell("8", 284, 4),
    cell("05/08/2026", 319, 40), cell("1.200,00", 389, 31), cell("150,00", 459, 24), cell("1.050,00", 519, 31),
  ];
  assert.deepEqual(assignToColumns(row, columns), [
    "1234567", "MARIA DA SILVA", "50000462", "8", "05/08/2026", "1.200,00", "150,00", "1.050,00",
  ]);
});

test("coluna de dinheiro alinhada à direita não desloca o valor de coluna", () => {
  const header = [
    cell("Numero da Guia", 24, 59), cell("Beneficiario", 94, 42), cell("Codigo TUSS", 224, 49), cell("Qtde", 284, 17),
    cell("Data Atendimento", 319, 64), cell("Valor Apresentado", 393, 59), cell("Valor Glosado", 463, 50), cell("Valor Liberado", 532, 51),
  ];
  const columns = scanHeaderFields(header);

  // Célula de glosa VAZIA: o valor liberado não pode escorregar para a glosa.
  const row = [
    cell("1234569", 24, 31), cell("CARLOS EDUARDO SOUZA", 94, 105), cell("50000470", 224, 36), cell("12", 284, 9),
    cell("07/08/2026", 319, 40), cell("1.800,00", 422, 31), cell("1.800,00", 552, 31),
  ];
  const texts = assignToColumns(row, columns);
  const mapping = new Map(columns.map((column, index) => [index, column.field]));
  const parsed = rowFromCells(texts, mapping)!;
  assert.equal(parsed.gross_amount, 1800);
  assert.equal(parsed.glosa_amount, undefined, "glosa vazia continua vazia");
  assert.equal(parsed.net_amount, 1800);
});
