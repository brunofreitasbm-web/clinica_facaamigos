/**
 * Unidades do PDV onde acontece a avaliação do playground. O código da unidade
 * (`fa_kiosk_units.id`) é um UUID: digitá-lo à mão dava errado ("01") e a lista do dia
 * do PDV vinha sempre vazia, sem nenhum erro. Por isso o local é ESCOLHIDO desta lista,
 * com o código já preenchido. O Circuito não entra: a avaliação é só nos playgrounds.
 * Se abrir um playground novo, acrescente a unidade aqui.
 */
export const PLAYGROUND_UNITS = [
  { posUnitId: "11111111-1111-1111-1111-111111111111", name: "Parque Shopping" },
  { posUnitId: "5fc99a57-81ee-4232-a105-1fcb4634cef4", name: "Bosque Grão-Pará" },
] as const;

export type PlaygroundUnit = (typeof PLAYGROUND_UNITS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devolve o código normalizado (minúsculo, sem espaços) ou `null` se não for um UUID. */
export function normalizePosUnitId(raw: string): string | null {
  const t = (raw ?? "").trim().toLowerCase();
  return UUID_RE.test(t) ? t : null;
}

/** A unidade de playground com esse código, ou `null` (inclui o Circuito e qualquer código digitado). */
export function findPlaygroundUnit(raw: string): PlaygroundUnit | null {
  const id = normalizePosUnitId(raw);
  return PLAYGROUND_UNITS.find((u) => u.posUnitId === id) ?? null;
}

export const PLAYGROUND_UNIT_HELP = "Escolha uma das unidades de playground da lista (Parque Shopping ou Bosque Grão-Pará).";
