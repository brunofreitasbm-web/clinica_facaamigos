// lib/priority-level-pure.ts

/** Níveis de prioridade de agendamento da 1ª avaliação por plano de saúde: de 1 a 10. */
export const MIN_PRIORITY_LEVEL = 1;
export const MAX_PRIORITY_LEVEL = 10;

/**
 * Próximo nível a criar para um plano. Lista vazia = nível 1. (`Math.max(...[])` dá
 * `-Infinity`, que virava NaN no envio e impedia criar a primeira prioridade.)
 */
export function nextPriorityLevel(existingLevels: number[]): number {
  const valid = existingLevels.filter((n) => Number.isInteger(n));
  return valid.length === 0 ? MIN_PRIORITY_LEVEL : Math.max(...valid) + 1;
}

/** NaN passa em `n < 1 || n > 10`: por isso a checagem exige inteiro. */
export function isValidPriorityLevel(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_PRIORITY_LEVEL && n <= MAX_PRIORITY_LEVEL;
}
