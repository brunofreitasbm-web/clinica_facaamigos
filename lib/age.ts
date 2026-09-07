// Idade cronológica no estilo Excel `DATEDIF(nasc, teste, "Y"/"M")`, usada
// pelas planilhas ADL/ADL-2 da clínica (ADL!C13/D13). O projeto não tem
// nenhuma biblioteca de datas (lib/timezone.ts:4 documenta a escolha
// deliberada de evitar date-fns/luxon) e nenhum helper de idade existente —
// esta é a primeira. Segue a mesma regra de `nextCalendarDay` em
// lib/timezone.ts:78-83: aritmética pura em `Date.UTC`, nunca
// `new Date("YYYY-MM-DD")` (que sofre shift de fuso — bug já corrigido no
// histórico do repositório para leitura de `patients.birth_date`).

export type ChronologicalAge = { years: number; months: number };

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/**
 * Idade cronológica entre duas datas `YYYY-MM-DD`, em anos completos e
 * meses completos excedentes — exatamente `DATEDIF(nasc, teste, "Y")` e
 * `DATEDIF(nasc, teste, "M") - anos*12`. Um mês só é contado como completo
 * quando o dia do teste é maior ou igual ao dia do nascimento; caso
 * contrário, mesmo com o mesmo dia-do-mês do próximo mês incompleto, ele
 * fica de fora (semântica do DATEDIF do Excel).
 */
export function chronologicalAge(birthIso: string, testIso: string): ChronologicalAge {
  const birth = parseIsoDate(birthIso);
  const test = parseIsoDate(testIso);

  let totalMonths = (test.y - birth.y) * 12 + (test.m - birth.m);
  if (test.d < birth.d) totalMonths -= 1;
  if (totalMonths < 0) totalMonths = 0;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths - years * 12;
  return { years, months };
}

/** "5 anos e 8 meses" / "8 meses" / "0 meses" — formato usado nas telas. */
export function formatChronologicalAge(age: ChronologicalAge): string {
  if (age.years <= 0) return `${age.months} ${age.months === 1 ? "mês" : "meses"}`;
  const yearsPart = `${age.years} ${age.years === 1 ? "ano" : "anos"}`;
  if (age.months === 0) return yearsPart;
  return `${yearsPart} e ${age.months} ${age.months === 1 ? "mês" : "meses"}`;
}
