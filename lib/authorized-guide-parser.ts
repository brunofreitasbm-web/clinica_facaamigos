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
  // 1. Rótulo explícito "6-Data da Validade da Senha" ou "Validade da Senha"
  for (const line of lines) {
    const labeled = line.match(
      /(?:6\s*-\s*Data\s+da\s+Validade\s+da\s+Senha|Validade\s+da\s+Senha|Validade\s+da\s+Guia)[\s:]*(\d{2})\/(\d{2})\/(\d{4})/i,
    );
    if (labeled) {
      const iso = toIso(labeled[1], labeled[2], labeled[3]);
      if (iso) return { value: iso, ambiguous: false };
    }
  }

  // 2. Par Senha (campo 5) + Data da Validade da Senha (campo 6) emitidos juntos pelo unpdf (ex.: "174321112 21/12/2026")
  for (const line of lines) {
    const pwdMatch = line.match(/^([A-Za-z0-9]{4,})\s+(\d{2})\/(\d{2})\/(\d{4})$/);
    if (pwdMatch) {
      const iso = toIso(pwdMatch[2], pwdMatch[3], pwdMatch[4]);
      if (iso) return { value: iso, ambiguous: false };
    }
  }

  // 3. Fallback por exclusão dos outros campos conhecidos
  const candidates: string[] = [];
  for (const line of lines) {
    const dates = [...line.matchAll(DATE_RE)];
    if (dates.length === 0) continue;
    // Validade da carteira (campo 9): desconsiderar (vem com flag RN "31/10/2026 N" ou com rótulo carteira)
    if (/\b\d{2}\/\d{2}\/\d{4}\s+[SN]\b/i.test(line)) continue;
    if (/carteira/i.test(line)) continue;
    // Data da solicitação (campo 22): vem logo depois do caráter do atendimento (1 dígito)
    if (/^\d\s+\d{2}\/\d{2}\/\d{4}$/.test(line)) continue;
    // Data da autorização (campo 4): data seguida de nº da guia atribuído pela operadora (ex.: "29/09/2026 17432111")
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d+$/.test(line)) continue;

    for (const [, d, m, y] of dates) {
      const iso = toIso(d, m, y);
      if (iso) candidates.push(iso);
    }
  }
  if (candidates.length === 0) return { value: null, ambiguous: true };
  const sorted = [...new Set(candidates)].sort();
  return { value: sorted[sorted.length - 1], ambiguous: sorted.length > 1 };
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
