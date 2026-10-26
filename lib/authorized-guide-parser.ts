// lib/authorized-guide-parser.ts
// Parser DETERMINÍSTICO (sem IA) da guia SP/SADT autorizada que o plano devolve
// (PDF digital "Guia_Solicit_SPSADT_*.pdf"). Trabalha sobre o texto já extraído
// do PDF (unpdf) e devolve só o que a recepção confere na etapa "Plano
// autorizou": nº da guia (campo 2), validade da senha (campo 6) e a tabela de
// procedimentos (campos 25 código, 26 descrição, 28 quantidade autorizada).
//
// O texto linearizado do unpdf perde a coluna de cada célula, então as datas do
// cabeçalho são separadas por exclusão (validade da carteira e data da
// solicitação vêm na mesma linha de um número/caráter de atendimento). Quando a
// exclusão não fecha, devolve aviso — nunca um palpite calado.
//
// Arquivo PURO (sem imports com alias `@/`) para rodar em tests/*.test.ts.

export type GuideProcedure = {
  /** Campo 25 — código do procedimento ou item assistencial (TUSS). */
  code: string;
  /** Campo 26 — descrição da terapia/procedimento. */
  description: string;
  /** Campo 28 — quantidade autorizada. */
  quantity: number;
};

export type ParsedAuthorizedGuide = {
  guideNumber: string | null;
  /** Campo 6 — data de validade da senha (= validade da guia), ISO yyyy-mm-dd. */
  validUntil: string | null;
  procedures: GuideProcedure[];
  warnings: string[];
};

const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;
// "1- TERAPIA ... CLÍNICO00 80011197 1 1"  → seq, descrição, tabela (00), código, qtde solic., qtde aut.
const PROCEDURE_RE = /^(\d{1,2})-\s*(.+?)\s*(\d{2})\s+(\d{8})\s+(\d+)\s+(\d+)\s*$/;

function toIso(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

function findValidUntil(lines: string[]): { value: string | null; ambiguous: boolean } {
  const candidates: string[] = [];
  for (const line of lines) {
    const dates = [...line.matchAll(DATE_RE)];
    if (dates.length === 0) continue;
    // Validade da carteira (campo 9): vem logo depois do nº da carteira na linha.
    if (/^\d{6,}\s+\d{2}\/\d{2}\/\d{4}$/.test(line)) continue;
    // Data da solicitação (campo 22): vem logo depois do caráter do atendimento (1 dígito).
    if (/^\d\s+\d{2}\/\d{2}\/\d{4}$/.test(line)) continue;
    for (const [, d, m, y] of dates) {
      const iso = toIso(d, m, y);
      if (iso) candidates.push(iso);
    }
  }
  if (candidates.length === 0) return { value: null, ambiguous: true };
  // Sobram data da autorização (campo 4) e validade da senha (campo 6): esta é a posterior.
  const sorted = [...new Set(candidates)].sort();
  return { value: sorted[sorted.length - 1], ambiguous: sorted.length > 2 };
}

export function parseAuthorizedGuideText(text: string): ParsedAuthorizedGuide {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const warnings: string[] = [];

  const guideMatch = text.match(/Guia\s+no\s+Prestador:\s*(\d{4,})/i);
  const guideNumber = guideMatch ? guideMatch[1] : null;
  if (!guideNumber) warnings.push("Não achei o nº da guia (campo 2) — digite à mão.");

  const procedures: GuideProcedure[] = [];
  for (const line of lines) {
    const match = line.match(PROCEDURE_RE);
    if (!match) continue;
    const quantity = Number(match[6]);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    procedures.push({ code: match[4], description: match[2].trim(), quantity });
  }
  if (procedures.length === 0) warnings.push("Não achei os procedimentos autorizados (campos 25 a 28) — preencha à mão.");

  const validity = findValidUntil(lines);
  if (!validity.value) warnings.push("Não achei a validade da senha (campo 6) — informe à mão.");
  else if (validity.ambiguous) warnings.push("Havia várias datas na guia — confira a validade da senha (campo 6).");

  return { guideNumber, validUntil: validity.value, procedures, warnings };
}
