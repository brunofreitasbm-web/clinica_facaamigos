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
 * Ordena todos os candidatos e devolve a página `page`. A página 0 (os 3
 * primeiros) segue o preenchimento de turno. A partir da 1 ("Nenhum serve"),
 * a prioridade é VARIAR O DIA: quem recusou os 3 horários não quer outros
 * horários dos mesmos dias, então vêm primeiro os melhores horários de dias
 * ainda não oferecidos (um por dia, em ordem de data); só depois, se o
 * calendário acabar, voltam a aparecer dias já oferecidos (outros horários).
 * Menos de 3 restantes devolve o que houver; página além do fim devolve [].
 */
export function pickOfferPage(
  candidates: OfferCandidate[],
  occupancy: ShiftOccupancy,
  page = 0,
  size = OFFER_PAGE_SIZE,
): OfferCandidate[] {
  const sorted = [...candidates].sort((a, b) => compareCandidates(a, b, occupancy));
  if (page === 0) return sorted.slice(0, size);

  const first = sorted.slice(0, size);
  const offeredDays = new Set(first.map((c) => c.date));
  const seenInDay = new Map<string, number>();
  const ranked = sorted.slice(size).map((c, order) => {
    const nth = seenInDay.get(c.date) ?? 0;
    seenInDay.set(c.date, nth + 1);
    // Dia já oferecido na página 0 perde uma "rodada": só volta depois que os dias novos
    // tiveram a vez. `order` mantém o preenchimento de turno como desempate.
    return { c, round: nth + (offeredDays.has(c.date) ? 1 : 0), order };
  });
  ranked.sort((x, y) => x.round - y.round || (x.c.date < y.c.date ? -1 : x.c.date > y.c.date ? 1 : 0) || x.order - y.order);
  return ranked.slice((page - 1) * size, page * size).map((r) => r.c);
}

export const EVALUATION_DURATION_MIN = 50;
/** Antecedência mínima: nunca oferecer um horário daqui a menos de 24h. */
export const MIN_LEAD_MS = 24 * 60 * 60 * 1000;

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
   * dia da semana, em minutos. `null` = nenhuma janela cadastrada → o
   * avaliador NÃO recebe avaliação (só se aloca dentro de disponibilidade
   * cadastrada).
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
      const windows: [number, number][] = therapist.windows?.get(dow) ?? [];
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
          const farEnough = startMs - input.nowMs >= MIN_LEAD_MS;

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

/**
 * Avaliador da 1ª avaliação no agendamento manual: entre os que estão no
 * expediente cadastrado e sem atendimento sobreposto naquele horário, vence
 * quem tem MENOS avaliações na semana (`weekLoad`); empate → menor id, só pra
 * ser determinístico. `null` = ninguém livre. Quem não tem janela cadastrada
 * (`windows: null`) está fora, igual ao gerador do bot.
 */
export function pickEvaluatorForSlot(input: {
  therapists: OfferTherapist[];
  busy: BusyRange[];
  weekLoad: Map<string, number>;
  /** Dia da semana do horário (0 = domingo). */
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  startMs: number;
  endMs: number;
}): string | null {
  const free = input.therapists.filter((t) => {
    const inside = (t.windows?.get(input.dayOfWeek) ?? []).some(([s, e]) => input.startMin >= s && input.endMin <= e);
    if (!inside) return false;
    return !findOverlap(
      input.busy.filter((b) => b.therapistId === t.id),
      input.startMs,
      input.endMs,
    );
  });
  free.sort((a, b) => {
    const diff = (input.weekLoad.get(a.id) ?? 0) - (input.weekLoad.get(b.id) ?? 0);
    return diff !== 0 ? diff : a.id < b.id ? -1 : 1;
  });
  return free[0]?.id ?? null;
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
