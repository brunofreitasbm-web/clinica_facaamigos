// lib/competence-label-pure.ts

const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11" ou "2026-11-01" vira "novembro de 2026". Entrada fora do padrão volta como veio. */
export function competenceLabel(input: string): string {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(input.trim());
  if (!m) return input;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return input;
  return `${MONTHS_PT[month - 1]} de ${m[1]}`;
}
