import { SOCIALLY_SAVVY_CATALOG } from "./catalog";

export * from "./types";
export * from "./catalog";
export * from "./scoring";

export const SOCIALLY_SAVVY_LABEL = "Socially Savvy — Avaliação de Habilidades Sociais";

/** Número máximo de aplicações do protocolo, como as colunas AV 1..4 da planilha. */
export const SOCIALLY_SAVVY_MAX_ROUNDS = 4;

export const SOCIALLY_SAVVY_ITEM_COUNT = SOCIALLY_SAVVY_CATALOG.reduce((n, area) => n + area.items.length, 0);

const CODE_TO_ITEM = new Map(
  SOCIALLY_SAVVY_CATALOG.flatMap((area) => area.items.map((item) => [item.code, { area, item }] as const)),
);

export function isSociallySavvyItemCode(code: string): boolean {
  return CODE_TO_ITEM.has(code);
}
