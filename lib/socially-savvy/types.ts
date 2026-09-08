// Tipos do Socially Savvy. Separados de scoring.ts pelo mesmo motivo de
// lib/fono-instruments/types.ts: scoring.ts importa daqui só com
// `import type`, então tests/socially-savvy-scoring.test.ts pode rodar sob
// `node --experimental-strip-types` sem puxar o grafo de módulos do app.

export type SociallySavvyStatus = "rascunho" | "concluida";

/** Pontuação de uma habilidade: 0 a 3, ou "NA" quando não foi avaliada. */
export type SociallySavvyScore = "0" | "1" | "2" | "3" | "NA";

/** `{ "JA01": "2", "SP03": "NA", ... }` — código da habilidade -> pontuação. */
export type SociallySavvyResponses = Record<string, SociallySavvyScore>;

export type SociallySavvyItem = {
  /** Código da planilha (JA01, SP01, ...). Chave estável das respostas. */
  code: string;
  text: string;
};

export type SociallySavvyArea = {
  key: string;
  label: string;
  items: SociallySavvyItem[];
};

export type SociallySavvyAreaResult = {
  key: string;
  label: string;
  /** Soma das pontuações da área (itens "NA" não somam). */
  achieved: number;
  /** Nº de itens × 3 — denominador fixo da planilha, não desconta "NA". */
  expected: number;
  /** achieved / expected, 0 a 1. */
  percent: number;
  scoredItems: number;
  naItems: number;
  unansweredItems: number;
};

/** Uma habilidade selecionada para o PEI, já com a área de origem. */
export type SociallySavvyObjective = {
  areaKey: string;
  areaLabel: string;
  code: string;
  text: string;
  score: number;
};

export type SociallySavvyResults = {
  areas: SociallySavvyAreaResult[];
  totalAchieved: number;
  totalExpected: number;
  totalPercent: number;
  /** Habilidades pontuadas com 2 — emergentes, o alvo imediato do PEI. */
  priorityObjectives: SociallySavvyObjective[];
  /** Habilidades pontuadas com 0 ou 1 — demais objetivos do PEI. */
  otherObjectives: SociallySavvyObjective[];
};
