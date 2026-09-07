// tests/fono-scoring.test.ts
//
// Verifica lib/fono-instruments/scoring.ts contra os exemplos já
// preenchidos nas próprias planilhas Excel da clínica (Planilhas/Fono/
// ADL.xlsx e PROC.xlsx), mais alguns casos sintéticos para exercitar as
// duas duplas contagens que o usuário pediu para reproduzir fielmente
// (ADL: faixa "2 anos até 2 anos e 5 meses" na Linguagem Expressiva; PROC:
// item "gestos" nos totais 1c-1/1c-2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chronologicalAge } from "../lib/age.ts";
import { ADL_BANDS, ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY } from "../lib/fono-instruments/adl.ts";
import { computeAdlResults, computeProcResults, computeFonologiaResults, classifyLanguage } from "../lib/fono-instruments/scoring.ts";
import { PROC_CATALOG } from "../lib/fono-instruments/proc.ts";
import { FONOLOGIA_BANDS } from "../lib/fono-instruments/adl2-fonologia.ts";
import type { AdlManualScores, AdlResponses, FonoBand, ProcResponses } from "../lib/fono-instruments/types.ts";

test("chronologicalAge reproduz DATEDIF do Excel (2017-07-01 -> 2023-03-15 = 5a 8m)", () => {
  assert.deepEqual(chronologicalAge("2017-07-01", "2023-03-15"), { years: 5, months: 8 });
});

test("chronologicalAge: mês só conta como completo quando o dia do teste >= dia do nascimento", () => {
  assert.deepEqual(chronologicalAge("2020-05-15", "2020-06-14"), { years: 0, months: 0 });
  assert.deepEqual(chronologicalAge("2020-05-15", "2020-06-15"), { years: 0, months: 1 });
});

test("classifyLanguage segue as 4 faixas do ADL/ADL-2", () => {
  assert.equal(classifyLanguage(100), "Faixa da normalidade");
  assert.equal(classifyLanguage(80), "Distúrbio Leve");
  assert.equal(classifyLanguage(73), "Distúrbio Moderado");
  assert.equal(classifyLanguage(50), "Distúrbio Severo");
  assert.equal(classifyLanguage(null), null);
});

test("computeAdlResults reproduz o exemplo preenchido na planilha ADL.xlsx", () => {
  const responses: AdlResponses = {
    "lr-1": "1",
    "lr-2": "1",
    "lr-3": "1",
    "lr-4": "NR",
    "lr-21": "0",
    "lr-22": "1",
    "lr-37": "1",
    "lr-38": "1",
    "lr-39": "0",
    "lr-40": "0",
    "le-24": "1",
    "le-28": "1",
    "le-31": "1",
    "le-36": "1",
    "le-37": "0",
    "le-38": "0",
    "le-39": "1",
    "le-40": "0",
  };
  const manual: AdlManualScores = {
    ultimaTarefaCorretaReceptiva: 20,
    ultimaTarefaCorretaExpressiva: 0,
    escorePadraoReceptivo: 70,
    escorePadraoExpressivo: 0,
    escorePadraoGlobal: 0,
  };

  const result = computeAdlResults(ADL_BANDS, responses, manual, {
    doubleCountExpressiveBandKey: ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY,
  });

  assert.equal(result.totalAcertosReceptivo, 6); // ADL!D83
  assert.equal(result.totalAcertosExpressivo, 5); // ADL!F83
  assert.equal(result.incorretasReceptivo, 3); // ADL!D88
  assert.equal(result.incorretasExpressivo, 3); // ADL!G88 (faixa dobrada estava vazia neste exemplo)
  assert.equal(result.escoreBrutoReceptivo, 17); // ADL!D89
  assert.equal(result.escoreBrutoExpressivo, 3); // ADL!G89
  assert.equal(result.escoreBrutoGlobal, 70); // ADL!C94 = D90+G90
  assert.equal(result.classificacao, "Distúrbio Severo"); // ADL!C96
});

test("computeAdlResults reproduz a dupla contagem da faixa expressiva 'b3' (bug fiel à planilha)", () => {
  const bands: FonoBand[] = [
    {
      key: "b3",
      label: "2 anos até 2 anos e 5 meses",
      receptive: [],
      expressive: [{ key: "le-9", num: 9, text: "item de teste" }],
    },
  ];
  const responses: AdlResponses = { "le-9": "0" };
  const manual: AdlManualScores = {
    ultimaTarefaCorretaReceptiva: 0,
    ultimaTarefaCorretaExpressiva: 10,
    escorePadraoReceptivo: null,
    escorePadraoExpressivo: null,
    escorePadraoGlobal: null,
  };

  const withBug = computeAdlResults(bands, responses, manual, { doubleCountExpressiveBandKey: "b3" });
  assert.equal(withBug.incorretasExpressivo, 2); // contado duas vezes
  assert.equal(withBug.escoreBrutoExpressivo, 8); // ABS(10-2)

  const withoutBug = computeAdlResults(bands, responses, manual, {});
  assert.equal(withoutBug.incorretasExpressivo, 1);
  assert.equal(withoutBug.escoreBrutoExpressivo, 9); // ABS(10-1)
});

test("objetivos prioritários (aba PEI) listam só itens com resposta '0', não 'NR' nem em branco", () => {
  const bands: FonoBand[] = [
    {
      key: "b1",
      label: "faixa",
      receptive: [
        { key: "lr-1", num: 1, text: "item errado" },
        { key: "lr-2", num: 2, text: "item sem resposta" },
        { key: "lr-3", num: 3, text: "item NR" },
      ],
      expressive: [],
    },
  ];
  const responses: AdlResponses = { "lr-1": "0", "lr-3": "NR" };
  const manual: AdlManualScores = {
    ultimaTarefaCorretaReceptiva: null,
    ultimaTarefaCorretaExpressiva: null,
    escorePadraoReceptivo: null,
    escorePadraoExpressivo: null,
    escorePadraoGlobal: null,
  };
  const result = computeAdlResults(bands, responses, manual, {});
  assert.deepEqual(
    result.objetivosPrioritariosReceptivo.map((i) => i.key),
    ["lr-1"],
  );
});

test("computeFonologiaResults conta por faixa e código (aba OBS AQUISIÇÃO FONOLÓGICA)", () => {
  const words = [
    { number: 1, bandKey: "f1" },
    { number: 2, bandKey: "f1" },
    { number: 3, bandKey: "f1" },
    { number: 20, bandKey: "f2" },
  ];
  const responses = { "1": "N", "2": "N", "3": "-", "20": "+" } as const;
  const result = computeFonologiaResults(words, FONOLOGIA_BANDS, responses as Record<string, "+" | "-" | "N" | "R" | "NR">);
  const f1 = result.find((b) => b.bandKey === "f1")!;
  assert.equal(f1.counts.N, 2);
  assert.equal(f1.counts["-"], 1);
  assert.equal(f1.counts["+"], 0);
  const f2 = result.find((b) => b.bandKey === "f2")!;
  assert.equal(f2.counts["+"], 1);
});

test("computeProcResults soma 1a/1b na escala 0/1/2 e reproduz a dupla contagem de 'gestos' em 1c-1/1c-2", () => {
  const responses: ProcResponses = {
    "1a-intencao_comunicativa": "2",
    "1a-inicia_conversacao": "2",
    "1a-responde_interlocutor": "2",
    "1a-aguarda_turno": "2",
    "1a-participa_dialogica": "2", // 1a = 10 (máximo)
    "1b-instrumental": "1",
    "1b-protesto": "1",
    "1b-interativa": "1",
    "1b-nomeacao": "1",
    "1b-informativa": "1",
    "1b-heuristica": "1",
    "1b-narrativa": "1", // 1b = 7
    "1c-vocalizacoes": "articuladas_jargao", // 2
    "1c-gestos": "simbolicos", // 5
    "1c-verbais": "frases_3", // 11
    "1d-nivel": "descreve_acao", // 10
    "2a-nivel": "duas_ordens", // 50
    "3a-diversificado_um_a_um": "on", // 5
    "3b-uso_convencional": "on", // 1
    "3c-enfileira": "on", // 2
    "3d-sonora_palavras": "on", // 5
  };

  const result = computeProcResults(PROC_CATALOG, responses);
  const section1 = result.sections.find((s) => s.key === "1")!;

  // Total 1c-1 = vocalizações(2)+gestos(5) = 7; Total 1c-2 = gestos(5)+verbais(11) = 16.
  // Total Geral 1 = 1a(10)+1b(7)+1c-1(7)+1c-2(16)+1d(10) = 50 — gestos (5) entra duas vezes.
  assert.equal(section1.score, 50);

  const section3 = result.sections.find((s) => s.key === "3")!;
  assert.equal(section3.score, 5 + 1 + 2 + 5); // 3a+3b+3c+3d = 13

  assert.equal(result.totalScore, section1.score + 50 /* seção 2 */ + section3.score);
});
