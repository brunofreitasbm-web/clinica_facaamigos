// Fórmulas de pontuação do ADL, ADL-2 e PROC, reproduzindo literalmente as
// planilhas Excel da clínica (Planilhas/Fono/{ADL,ADL--2,PROC}.xlsx),
// incluindo as duas duplas contagens que as planilhas têm e que o usuário
// pediu para manter fielmente:
//  - ADL: o total de respostas incorretas da Linguagem Expressiva conta a
//    faixa "2 anos até 2 anos e 5 meses" duas vezes (ADL!G88 soma
//    COUNTIF(F42:F45,"0") duas vezes). Ver `doubleCountExpressiveBandKey`.
//  - PROC: "Total 1c-1" soma vocalizações+gestos e "Total 1c-2" soma
//    gestos+verbais (PROC!C62/C63); o Total Geral (PROC!C69) soma os dois,
//    então os pontos de gestos entram duas vezes.
//
// Pura em TypeScript, sem Supabase — testada em tests/fono-scoring.test.ts
// contra os exemplos já preenchidos nas próprias planilhas.
import type {
  AdlBandResult,
  AdlManualScores,
  AdlResponses,
  AdlResults,
  FonoBand,
  FonoItem,
  FonologiaBandCount,
  FonologiaResponses,
  LanguageClassification,
  ProcResponses,
  ProcResults,
  ProcSectionResult,
  ProcSubsectionResult,
} from "./types";
import type { ProcSection, FonologiaCode } from "./types";
import type { FonologiaBand } from "./adl2-fonologia";

function isCorrect(v: string | undefined): boolean {
  return v === "1";
}
function isIncorrect(v: string | undefined): boolean {
  // A planilha só conta "0" como incorreto — um item deixado em branco ou
  // "NR" (nenhuma resposta) NÃO entra no COUNTIF(...,"0"), mesmo o manual
  // do ADL dizendo que NR deveria valer 0. Fidelidade à planilha (decisão
  // do usuário).
  return v === "0";
}

/**
 * Escore bruto = ABS(última tarefa correta − total de incorretas), igual a
 * ADL!D89 (`=ABS(D87-D88)`). `null` quando a última tarefa correta ainda
 * não foi digitada pelo examinador.
 */
function computeRawScore(lastCorrectTask: number | null, incorrectCount: number): number | null {
  if (lastCorrectTask === null) return null;
  return Math.abs(lastCorrectTask - incorrectCount);
}

/** ADL!C96 / ADL-2!C119 — classificação a partir do Escore Padrão da Linguagem Global. */
export function classifyLanguage(epGlobal: number | null): LanguageClassification {
  if (epGlobal === null) return null;
  if (epGlobal >= 85 && epGlobal <= 115) return "Faixa da normalidade";
  if (epGlobal >= 77 && epGlobal <= 84) return "Distúrbio Leve";
  if (epGlobal >= 70 && epGlobal <= 76) return "Distúrbio Moderado";
  if (epGlobal >= 0 && epGlobal <= 69) return "Distúrbio Severo";
  return null; // planilha mostra "0" fora dessas faixas — tratamos como "sem classificação".
}

export type AdlScoringOptions = {
  /**
   * Chave da faixa cuja contagem de incorretas da escala expressiva deve
   * ser somada duas vezes — reproduz o bug de fórmula do ADL original
   * (ADL!G88 repete `COUNTIF(F42:F45,"0")`, a faixa "2 anos até 2 anos e 5
   * meses"). O ADL-2 não tem esse bug: passar `undefined`.
   */
  doubleCountExpressiveBandKey?: string;
};

export function computeAdlResults(
  bands: FonoBand[],
  responses: AdlResponses,
  manual: AdlManualScores,
  options: AdlScoringOptions = {},
): AdlResults {
  const bandTotals: AdlBandResult[] = [];
  let totalAcertosReceptivo = 0;
  let totalAcertosExpressivo = 0;
  let incorretasReceptivo = 0;
  let incorretasExpressivo = 0;
  const objetivosPrioritariosReceptivo: FonoItem[] = [];
  const objetivosPrioritariosExpressivo: FonoItem[] = [];

  for (const band of bands) {
    let receptiveTotal = 0;
    let expressiveTotal = 0;
    let bandIncorrectExpressivo = 0;

    for (const item of band.receptive) {
      const v = responses[item.key];
      if (isCorrect(v)) receptiveTotal += 1;
      if (isIncorrect(v)) {
        incorretasReceptivo += 1;
        objetivosPrioritariosReceptivo.push(item); // PEI!B_n = IF(...=0, texto, "-")
      }
    }
    for (const item of band.expressive) {
      const v = responses[item.key];
      if (isCorrect(v)) expressiveTotal += 1;
      if (isIncorrect(v)) {
        bandIncorrectExpressivo += 1;
        objetivosPrioritariosExpressivo.push(item);
      }
    }

    incorretasExpressivo += bandIncorrectExpressivo;
    if (options.doubleCountExpressiveBandKey === band.key) {
      incorretasExpressivo += bandIncorrectExpressivo; // duplicação intencional (bug replicado da planilha)
    }

    totalAcertosReceptivo += receptiveTotal;
    totalAcertosExpressivo += expressiveTotal;
    bandTotals.push({ bandKey: band.key, bandLabel: band.label, receptiveTotal, expressiveTotal });
  }

  const escoreBrutoReceptivo = computeRawScore(manual.ultimaTarefaCorretaReceptiva, incorretasReceptivo);
  const escoreBrutoExpressivo = computeRawScore(manual.ultimaTarefaCorretaExpressiva, incorretasExpressivo);

  // ADL!C94 "ESCORE BRUTO DA LINGUAGEM GLOBAL" = D90+G90 — apesar do nome,
  // soma os dois Escores Padrão (não os escores brutos); mantido fiel à
  // planilha.
  const escoreBrutoGlobal =
    manual.escorePadraoReceptivo !== null && manual.escorePadraoExpressivo !== null
      ? manual.escorePadraoReceptivo + manual.escorePadraoExpressivo
      : null;

  return {
    bandTotals,
    totalAcertosReceptivo,
    totalAcertosExpressivo,
    incorretasReceptivo,
    incorretasExpressivo,
    escoreBrutoReceptivo,
    escoreBrutoExpressivo,
    escoreBrutoGlobal,
    classificacao: classifyLanguage(manual.escorePadraoGlobal),
    objetivosPrioritariosReceptivo,
    objetivosPrioritariosExpressivo,
  };
}

const FONOLOGIA_CODES: FonologiaCode[] = ["+", "-", "N", "R", "NR"];

/** Contagem por faixa e código (equivalente aos COUNTIF da aba "OBS AQUISIÇÃO FONOLÓGICA"). */
export function computeFonologiaResults(
  words: { number: number; bandKey: string }[],
  bands: FonologiaBand[],
  responses: FonologiaResponses,
): FonologiaBandCount[] {
  return bands.map((band) => {
    const counts: Record<FonologiaCode, number> = { "+": 0, "-": 0, N: 0, R: 0, NR: 0 };
    for (const word of words) {
      if (word.bandKey !== band.key) continue;
      const v = responses[String(word.number)] as FonologiaCode | undefined;
      if (v && FONOLOGIA_CODES.includes(v)) counts[v] += 1;
    }
    return { bandKey: band.key, bandLabel: band.label, counts };
  });
}

// --- PROC ---------------------------------------------------------------

function responseKey(subsectionKey: string, itemKey: string): string {
  return `${subsectionKey}-${itemKey}`;
}

function scoreScale012Subsection(subsectionKey: string, items: { key: string }[], responses: ProcResponses): number {
  let total = 0;
  for (const item of items) {
    const v = responses[responseKey(subsectionKey, item.key)];
    const n = v === undefined ? 0 : Number(v);
    total += Number.isFinite(n) ? n : 0;
  }
  return total;
}

function scoreSingleItem(subsectionKey: string, item: { key: string; options?: { key: string; value: number }[] }, responses: ProcResponses): number {
  const chosenKey = responses[responseKey(subsectionKey, item.key)];
  const option = item.options?.find((o) => o.key === chosenKey);
  return option?.value ?? 0;
}

function scoreMultiSubsection(subsectionKey: string, items: { key: string; options?: { key: string; value: number }[] }[], responses: ProcResponses): number {
  let total = 0;
  for (const item of items) {
    const marked = responses[responseKey(subsectionKey, item.key)];
    const option = item.options?.[0];
    if (marked === "on" && option) total += option.value;
  }
  return total;
}

export function computeProcResults(catalog: ProcSection[], responses: ProcResponses): ProcResults {
  const sections: ProcSectionResult[] = catalog.map((section) => {
    const subsections: ProcSubsectionResult[] = section.subsections.map((sub) => {
      let score = 0;
      if (sub.mode === "scale012") {
        score = scoreScale012Subsection(sub.key, sub.items, responses);
      } else if (sub.mode === "multi") {
        score = scoreMultiSubsection(sub.key, sub.items, responses);
      } else {
        // "single": soma o valor escolhido de cada item da subseção — em
        // 1c isso soma vocalizações+gestos+verbais nos dois totais
        // parciais (ver comentário abaixo, PROC!C62/C63).
        score = sub.items.reduce((acc, item) => acc + scoreSingleItem(sub.key, item, responses), 0);
      }
      return { key: sub.key, label: sub.label, max: sub.max, score };
    });

    // PROC!C62 "Total 1c-1" = vocalizações+gestos; PROC!C63 "Total 1c-2" =
    // gestos+verbais — a subseção "1c" acima já soma os três juntos
    // (vocalizações+gestos+verbais uma vez cada); para reproduzir a dupla
    // contagem de gestos no Total Geral, somamos novamente a pontuação do
    // item "gestos" à pontuação da subseção 1c.
    let sectionScore = subsections.reduce((acc, s) => acc + s.score, 0);
    if (section.key === "1") {
      const meiosSub = section.subsections.find((s) => s.key === "1c");
      const gestosItem = meiosSub?.items.find((i) => i.key === "gestos");
      if (gestosItem) sectionScore += scoreSingleItem("1c", gestosItem, responses);
    }

    return { key: section.key, label: section.label, max: section.max, score: sectionScore, subsections };
  });

  return {
    sections,
    totalMax: sections.reduce((acc, s) => acc + s.max, 0),
    totalScore: sections.reduce((acc, s) => acc + s.score, 0),
  };
}
