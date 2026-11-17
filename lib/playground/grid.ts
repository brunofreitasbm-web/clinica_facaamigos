// Grade do Playground: turnos fechados de 2h, por unidade, com aviso de lotação.
import { PLAYGROUND_BLOCK_CAPACITY } from "./constants.ts";

export type PlaygroundBlock = { start: string; end: string; label: string };

const block = (startHour: number): PlaygroundBlock => {
  const h = (n: number) => String(n).padStart(2, "0");
  return { start: `${h(startHour)}:00`, end: `${h(startHour + 2)}:00`, label: `${startHour}h às ${startHour + 2}h` };
};

/** Turnos de 2h conforme o horário do shopping (10h-12h, 12h-14h, 14h-16h). Ajuste aqui se o shopping mudar. */
export const PLAYGROUND_BLOCKS: readonly PlaygroundBlock[] = [block(10), block(12), block(14)];

/** Cor de cada quadro por unidade (tokens de cor do tema; sem hex fixo). */
export const PLAYGROUND_UNIT_TONE: Record<string, { bg: string; border: string; text: string }> = {
  // Parque Shopping: âmbar.
  "11111111-1111-1111-1111-111111111111": {
    bg: "var(--color-accent-2-100)",
    border: "var(--color-accent-2-500)",
    text: "var(--color-accent-2-700)",
  },
  // Bosque Grão-Pará: verde-água.
  "5fc99a57-81ee-4232-a105-1fcb4634cef4": {
    bg: "var(--color-teal-100)",
    border: "var(--color-teal-hover)",
    text: "var(--color-teal-800)",
  },
};

/** Turno que contém o horário `HH:mm` (início inclusive, fim exclusive), ou null se cai fora dos turnos fixos. */
export function blockForTime(time: string): PlaygroundBlock | null {
  return PLAYGROUND_BLOCKS.find((b) => time >= b.start && time < b.end) ?? null;
}

/** Quantas visitas começam dentro do turno (as canceladas já vêm filtradas). */
export function countInBlock(visitStarts: readonly string[], block: PlaygroundBlock): number {
  return visitStarts.filter((t) => blockForTime(t)?.start === block.start).length;
}

/** Aviso, sem travar: passou da lotação do turno. */
export function overCapacity(count: number): boolean {
  return count > PLAYGROUND_BLOCK_CAPACITY;
}

export function capacityMessage(count: number): string | null {
  return overCapacity(count)
    ? `Turno com ${count} crianças. O recomendado é no máximo ${PLAYGROUND_BLOCK_CAPACITY}, mas o agendamento segue.`
    : null;
}
