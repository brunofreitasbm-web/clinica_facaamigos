// Tabelas normativas do ADL/ADL-2 (conversão de escore bruto -> escore
// padrão por faixa etária, e de soma de escores padrão -> escore padrão da
// linguagem global) pertencem ao manual do examinador, um material
// comercial (Pró-Fono / Book Toy) que não está disponível publicamente —
// só o protocolo de aplicação e pontuação está livre em
// booktoy.com.br/download/Protocolo%20ADL2_28x21_ALT4.pdf, e ele
// explicitamente delega essa conversão a "TABELA 1" e "TABELA 2" do manual,
// que não são reproduzidas ali.
//
// Por isso o formulário pede os escores padrão (EP) por entrada manual,
// exatamente como a planilha da clínica faz hoje (ADL!D90, ADL!F90,
// ADL!C95). Esta tabela fica vazia e pronta para ser preenchida se algum
// dia a clínica tiver o manual em mãos — quando uma faixa etária tiver
// entrada aqui, a UI pode passar a sugerir o EP automaticamente a partir do
// escore bruto, mas o campo continua editável (o examinador sempre pode
// corrigir).
import type { FonoInstrument } from "./types";

export type StandardScoreTable = {
  /** Faixa etária (chave de FonoBand) -> lista de pontos [escoreBruto, escorePadrao] ordenados. */
  bands: Record<string, [number, number][]>;
};

export const ADL_NORMS: Partial<Record<Extract<FonoInstrument, "adl" | "adl2">, { receptive: StandardScoreTable; expressive: StandardScoreTable }>> = {
  // adl: { receptive: { bands: {} }, expressive: { bands: {} } },
  // adl2: { receptive: { bands: {} }, expressive: { bands: {} } },
};

/**
 * Busca o escore padrão correspondente a um escore bruto, interpolando
 * linearmente entre os dois pontos mais próximos da tabela da faixa etária.
 * Retorna `null` quando não há tabela cadastrada para o instrumento/escala/
 * faixa — nesse caso a UI deve exigir o preenchimento manual (comportamento
 * atual, já que nenhuma tabela está cadastrada).
 */
export function lookupStandardScore(
  instrument: FonoInstrument,
  scale: "receptive" | "expressive",
  bandKey: string,
  rawScore: number,
): number | null {
  if (instrument !== "adl" && instrument !== "adl2") return null;
  const table = ADL_NORMS[instrument]?.[scale];
  const points = table?.bands[bandKey];
  if (!points || points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (rawScore <= sorted[0][0]) return sorted[0][1];
  if (rawScore >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];

  for (let i = 0; i < sorted.length - 1; i++) {
    const [x0, y0] = sorted[i];
    const [x1, y1] = sorted[i + 1];
    if (rawScore >= x0 && rawScore <= x1) {
      if (x1 === x0) return y0;
      const t = (rawScore - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return null;
}
