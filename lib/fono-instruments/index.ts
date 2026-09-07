import type { FonoInstrument } from "./types";
import { ADL_BANDS, ADL_LABEL, ADL_RECEPTIVE_LABEL, ADL_EXPRESSIVE_LABEL } from "./adl";
import { ADL2_BANDS, ADL2_LABEL, ADL2_RECEPTIVE_LABEL, ADL2_EXPRESSIVE_LABEL } from "./adl2";
import { FONOLOGIA_WORDS, FONOLOGIA_BANDS } from "./adl2-fonologia";
import { PROC_CATALOG } from "./proc";

export * from "./types";
export * from "./adl";
export * from "./adl2";
export * from "./adl2-fonologia";
export * from "./proc";
export * from "./scoring";
export * from "./norms";

export const FONO_INSTRUMENT_LABEL: Record<FonoInstrument, string> = {
  adl: ADL_LABEL,
  adl2: ADL2_LABEL,
  proc: "PROC — Protocolo de Observação Comportamental",
};

export const FONO_INSTRUMENTS: FonoInstrument[] = ["adl", "adl2", "proc"];

export function isFonoInstrument(value: string): value is FonoInstrument {
  return (FONO_INSTRUMENTS as string[]).includes(value);
}

export function getFonoBands(instrument: "adl" | "adl2") {
  return instrument === "adl" ? ADL_BANDS : ADL2_BANDS;
}

export function getFonoScaleLabels(instrument: "adl" | "adl2") {
  return instrument === "adl"
    ? { receptive: ADL_RECEPTIVE_LABEL, expressive: ADL_EXPRESSIVE_LABEL }
    : { receptive: ADL2_RECEPTIVE_LABEL, expressive: ADL2_EXPRESSIVE_LABEL };
}

export { FONOLOGIA_WORDS, FONOLOGIA_BANDS, PROC_CATALOG };
