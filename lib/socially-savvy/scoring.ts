// Cálculos do Socially Savvy — as fórmulas que a planilha
// Planilhas/SOCIALLY--SAVVY-PEI.xlsx fazia nas abas AV 1..4, CONSOLIDADO e PEI.
//
// Rodado nos dois lados: no formulário (preview ao vivo) e de novo no servidor
// em lib/socially-savvy-assessment-actions.ts, que é o valor gravado — o
// cliente nunca decide o resultado. Só importa tipos, nunca módulos de runtime.

import type {
  SociallySavvyArea,
  SociallySavvyAreaResult,
  SociallySavvyObjective,
  SociallySavvyResponses,
  SociallySavvyResults,
  SociallySavvyScore,
} from "./types";

/** Pontuação máxima por habilidade — define o "pontos esperados" de cada área. */
export const SOCIALLY_SAVVY_MAX_SCORE = 3;

export const SOCIALLY_SAVVY_SCORE_OPTIONS: SociallySavvyScore[] = ["0", "1", "2", "3", "NA"];

export const SOCIALLY_SAVVY_SCORE_LABEL: Record<SociallySavvyScore, string> = {
  "0": "Não demonstra",
  "1": "Raramente",
  "2": "Emergente",
  "3": "Adquirida",
  NA: "Não avaliada",
};

export function isSociallySavvyScore(value: string): value is SociallySavvyScore {
  return (SOCIALLY_SAVVY_SCORE_OPTIONS as string[]).includes(value);
}

export function computeSociallySavvyResults(
  catalog: SociallySavvyArea[],
  responses: SociallySavvyResponses,
): SociallySavvyResults {
  const areas: SociallySavvyAreaResult[] = [];
  const priorityObjectives: SociallySavvyObjective[] = [];
  const otherObjectives: SociallySavvyObjective[] = [];

  for (const area of catalog) {
    let achieved = 0;
    let scoredItems = 0;
    let naItems = 0;
    let unansweredItems = 0;

    for (const item of area.items) {
      const raw = responses[item.code];
      if (raw === undefined) {
        unansweredItems += 1;
        continue;
      }
      if (raw === "NA") {
        naItems += 1;
        continue;
      }
      const score = Number(raw);
      achieved += score;
      scoredItems += 1;

      const objective: SociallySavvyObjective = {
        areaKey: area.key,
        areaLabel: area.label,
        code: item.code,
        text: item.text,
        score,
      };
      // Regra da aba PEI da planilha: 2 = objetivo prioritário (habilidade
      // emergente, mais perto de ser adquirida); 0 e 1 = demais objetivos.
      // 3 já está adquirida e sai do plano.
      if (score === 2) priorityObjectives.push(objective);
      else if (score === 0 || score === 1) otherObjectives.push(objective);
    }

    const expected = area.items.length * SOCIALLY_SAVVY_MAX_SCORE;
    areas.push({
      key: area.key,
      label: area.label,
      achieved,
      expected,
      percent: expected === 0 ? 0 : achieved / expected,
      scoredItems,
      naItems,
      unansweredItems,
    });
  }

  const totalAchieved = areas.reduce((sum, a) => sum + a.achieved, 0);
  const totalExpected = areas.reduce((sum, a) => sum + a.expected, 0);

  return {
    areas,
    totalAchieved,
    totalExpected,
    totalPercent: totalExpected === 0 ? 0 : totalAchieved / totalExpected,
    priorityObjectives,
    otherObjectives,
  };
}
