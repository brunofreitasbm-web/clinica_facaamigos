// Tipos compartilhados dos instrumentos de fonoaudiologia (ADL, ADL-2, PROC).
// scoring.ts importa só `import type` daqui — nenhum destes tipos existe em
// runtime, então tests/fono-scoring.test.ts (rodado com
// `node --experimental-strip-types`) pode importar scoring.ts sem puxar um
// grafo de módulos que o strip-types não resolve.

export type FonoInstrument = "adl" | "adl2" | "proc";

export type FonoAssessmentStatus = "rascunho" | "concluida";

/** Um item pontuável dentro de uma faixa etária (ADL/ADL-2). */
export type FonoItem = {
  key: string;
  num: number;
  text: string;
};

/** Uma faixa etária do ADL/ADL-2, com os itens de cada escala. */
export type FonoBand = {
  key: string;
  label: string;
  receptive: FonoItem[];
  expressive: FonoItem[];
};

/** Resposta de um item do ADL/ADL-2: acerto, erro ou "nenhuma resposta". */
export type AdlItemResponse = "1" | "0" | "NR";

/** `{ "lr-1": "1", "le-3": "0", ... }` — chave do item -> resposta. */
export type AdlResponses = Record<string, AdlItemResponse>;

/** Código da observação da aquisição fonológica do ADL-2. */
export type FonologiaCode = "+" | "-" | "N" | "R" | "NR";

/** `{ "1": "+", "2": "N", ... }` — número da palavra -> código observado. */
export type FonologiaResponses = Record<string, FonologiaCode>;

/** Escores digitados manualmente pelo examinador a partir do manual do instrumento. */
export type AdlManualScores = {
  ultimaTarefaCorretaReceptiva: number | null;
  ultimaTarefaCorretaExpressiva: number | null;
  escorePadraoReceptivo: number | null;
  escorePadraoExpressivo: number | null;
  escorePadraoGlobal: number | null;
};

export type AdlBandResult = {
  bandKey: string;
  bandLabel: string;
  receptiveTotal: number;
  expressiveTotal: number;
};

export type FonologiaBandCount = {
  bandKey: string;
  bandLabel: string;
  counts: Record<FonologiaCode, number>;
};

export type LanguageClassification =
  | "Faixa da normalidade"
  | "Distúrbio Leve"
  | "Distúrbio Moderado"
  | "Distúrbio Severo"
  | null;

export type AdlResults = {
  bandTotals: AdlBandResult[];
  totalAcertosReceptivo: number;
  totalAcertosExpressivo: number;
  incorretasReceptivo: number;
  incorretasExpressivo: number;
  escoreBrutoReceptivo: number | null;
  escoreBrutoExpressivo: number | null;
  escoreBrutoGlobal: number | null;
  classificacao: LanguageClassification;
  fonologia?: FonologiaBandCount[];
  objetivosPrioritariosReceptivo: FonoItem[];
  objetivosPrioritariosExpressivo: FonoItem[];
};

/** Modo de pontuação de uma subseção do PROC. */
export type ProcSectionMode = "scale012" | "single" | "multi";

export type ProcOption = {
  key: string;
  label: string;
  value: number;
};

export type ProcItem = {
  key: string;
  label: string;
  /** Presente só quando mode = "scale012": as 3 opções 0/1/2 são implícitas (ver proc.ts). */
  options?: ProcOption[];
};

export type ProcSubsection = {
  key: string;
  label: string;
  mode: ProcSectionMode;
  max: number;
  items: ProcItem[];
};

export type ProcSection = {
  key: string;
  label: string;
  max: number;
  subsections: ProcSubsection[];
};

/** `{ "1a-item1": "2", "3a-opt1": "1", ... }` — chave do item/opção -> valor pontuado (string do número, ou "on" p/ multi marcado). */
export type ProcResponses = Record<string, string>;

export type ProcSubsectionResult = {
  key: string;
  label: string;
  max: number;
  score: number;
};

export type ProcSectionResult = {
  key: string;
  label: string;
  max: number;
  score: number;
  subsections: ProcSubsectionResult[];
};

export type ProcResults = {
  sections: ProcSectionResult[];
  totalMax: number;
  totalScore: number;
};
