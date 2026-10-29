// lib/evaluation-offer-slots-pure.ts
// Ordenação PURA dos horários que o bot oferece ao responsável para a 1ª
// avaliação. Regra de negócio: completar turnos — acabar a manhã inteira,
// depois a tarde, depois passar ao dia seguinte — para a agenda das
// avaliadoras ficar compacta em vez de furada. Sem import com alias `@/` para
// rodar em `node --test --experimental-strip-types`
// (tests/evaluation-offer-slots-pure.test.ts). Quem chama injeta a conversão
// de fuso (`toUtcMs`), então nada aqui depende de `@/lib/timezone`.

import {
  closedReason,
  timeToMinutes,
  weekdayOf,
  type BusinessHourRow,
  type ClinicClosure,
} from "./clinic-calendar-pure.ts";

export type Shift = "manha" | "tarde";

export type OfferCandidate = {
  /** Dia civil "YYYY-MM-DD" (CLINIC_TIMEZONE). */
  date: string;
  /** Minutos desde 00:00. */
  startMin: number;
  endMin: number;
  therapistId: string;
  roomId: string;
  startsAtIso: string;
  endsAtIso: string;
};

/**
 * Quantos atendimentos a avaliadora já tem naquele dia+turno.
 * Chave: `${therapistId}|${date}|${shift}` (use `occupancyKey`).
 */
export type ShiftOccupancy = Map<string, number>;

export const SHIFT_SPLIT_MIN = 12 * 60;
export const OFFER_PAGE_SIZE = 3;

export function shiftOf(startMin: number): Shift {
  return startMin < SHIFT_SPLIT_MIN ? "manha" : "tarde";
}

export function occupancyKey(therapistId: string, date: string, shift: Shift): string {
  return `${therapistId}|${date}|${shift}`;
}

/**
 * Compara dois candidatos na ordem de preenchimento: dia ↑, depois manhã
 * antes de tarde. Dentro do mesmo dia+turno, a avaliadora MAIS ocupada vem
 * primeiro (completa o turno dela antes de abrir o de outra) e, empatando,
 * o horário mais cedo; por fim terapeuta/sala só pra ordem ser determinística.
 */
export function compareCandidates(a: OfferCandidate, b: OfferCandidate, occupancy: ShiftOccupancy): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;

  const shift = shiftOf(a.startMin);
  if (shift !== shiftOf(b.startMin)) return shift === "manha" ? -1 : 1;

  const loadA = occupancy.get(occupancyKey(a.therapistId, a.date, shift)) ?? 0;
  const loadB = occupancy.get(occupancyKey(b.therapistId, b.date, shift)) ?? 0;
  if (loadA !== loadB) return loadB - loadA;

  if (a.startMin !== b.startMin) return a.startMin - b.startMin;
  if (a.therapistId !== b.therapistId) return a.therapistId < b.therapistId ? -1 : 1;
  return a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0;
}

/**
 * Ordena todos os candidatos e devolve a página `page` (0 = os 3 primeiros,
 * 1 = "Nenhum serve" → os 3 seguintes...). Menos de 3 restantes devolve o que
 * houver; página além do fim devolve lista vazia.
 */
export function pickOfferPage(
  candidates: OfferCandidate[],
  occupancy: ShiftOccupancy,
  page = 0,
  size = OFFER_PAGE_SIZE,
): OfferCandidate[] {
  const sorted = [...candidates].sort((a, b) => compareCandidates(a, b, occupancy));
  return sorted.slice(page * size, page * size + size);
}

export const EVALUATION_DURATION_MIN = 50;
// Regra da data mais próxima: sugerimos o primeiro horário vago a partir de AMANHÃ
// (nunca o mesmo dia — dá tempo de a família escolher, a supervisão confirmar e a
// família se organizar). Quem chama informa o 1º dia permitido em `earliestDate`.

export type BusyRange = {
  therapistId: string;
  roomId: string | null;
  startMs: number;
  endMs: number;
  /** Dia civil e minuto-do-dia do início (CLINIC_TIMEZONE), pra contar ocupação por turno. */
  date: string;
  startMin: number;
};

export type OfferTherapist = {
  id: string;
  /**
   * Janelas de disponibilidade cadastradas (professional_availability), por
   * dia da semana, em minutos. `null` = nenhuma janela cadastrada ainda
   * ("não configurado", não "indisponível") → vale o expediente da clínica,
   * mesma semântica do trigger appointments_availability_guard.
   */
  windows: Map<number, [number, number][]> | null;
};

export type GenerateCandidatesInput = {
  /** Dias civis "YYYY-MM-DD" a varrer, em ordem. */
  days: string[];
  therapists: OfferTherapist[];
  roomIds: string[];
  busy: BusyRange[];
  businessHours: BusinessHourRow[];
  closures: ClinicClosure[];
  nowMs: number;
  /** Primeiro dia civil que pode ser sugerido ("YYYY-MM-DD", inclusive): amanhã. */
  earliestDate: string;
  /** "YYYY-MM-DD" + minutos → instante UTC em ms (já no fuso da clínica). */
  toUtcMs: (date: string, minutes: number) => number;
  durationMin?: number;
};

function findOverlap(list: BusyRange[], startMs: number, endMs: number): BusyRange | null {
  return list.find((b) => startMs < b.endMs && endMs > b.startMs) ?? null;
}

/**
 * Candidatos de 1ª avaliação, encostados um no outro: dentro de cada janela a
 * avaliadora é preenchida em sequência (08:00, 08:50, 09:40…) e, quando
 * esbarra num atendimento existente, retoma logo depois dele. É isso que
 * "completar o turno" precisa — um passo de 30min deixaria buracos de 10min.
 * A sala é a primeira sala de avaliação livre naquele instante.
 */
export function generateEvaluationCandidates(input: GenerateCandidatesInput): OfferCandidate[] {
  const duration = input.durationMin ?? EVALUATION_DURATION_MIN;
  const out: OfferCandidate[] = [];

  for (const date of input.days) {
    const dow = weekdayOf(date);
    const shifts = input.businessHours.filter((r) => r.day_of_week === dow);
    if (shifts.length === 0) continue;

    for (const therapist of input.therapists) {
      const windows: [number, number][] = therapist.windows
        ? (therapist.windows.get(dow) ?? [])
        : shifts.map((r): [number, number] => [timeToMinutes(r.open_time), timeToMinutes(r.close_time)]);
      const therapistBusy = input.busy.filter((b) => b.therapistId === therapist.id);

      for (const [winStart, winEnd] of windows) {
        let cursor = winStart;
        while (cursor + duration <= winEnd) {
          const startMs = input.toUtcMs(date, cursor);
          const endMs = input.toUtcMs(date, cursor + duration);

          const clash = findOverlap(therapistBusy, startMs, endMs);
          if (clash) {
            // Retoma depois do atendimento existente, arredondando pra 5min.
            const clashEndMin = cursor + Math.ceil((clash.endMs - startMs) / 60_000);
            cursor = Math.max(cursor + 5, Math.ceil(clashEndMin / 5) * 5);
            continue;
          }

          const closed = closedReason(date, cursor, cursor + duration, {
            businessHours: input.businessHours,
            closures: input.closures,
          });
          const farEnough = date >= input.earliestDate && startMs > input.nowMs;

          if (!closed && farEnough) {
            const roomId = input.roomIds.find((rid) => !findOverlap(input.busy.filter((b) => b.roomId === rid), startMs, endMs));
            if (roomId) {
              out.push({
                date,
                startMin: cursor,
                endMin: cursor + duration,
                therapistId: therapist.id,
                roomId,
                startsAtIso: new Date(startMs).toISOString(),
                endsAtIso: new Date(endMs).toISOString(),
              });
            }
          }
          cursor += duration;
        }
      }
    }
  }
  return out;
}

/** Ocupação por avaliadora+dia+turno a partir dos atendimentos já marcados. */
export function buildOccupancy(busy: BusyRange[]): ShiftOccupancy {
  const occ: ShiftOccupancy = new Map();
  for (const b of busy) {
    const key = occupancyKey(b.therapistId, b.date, shiftOf(b.startMin));
    occ.set(key, (occ.get(key) ?? 0) + 1);
  }
  return occ;
}
