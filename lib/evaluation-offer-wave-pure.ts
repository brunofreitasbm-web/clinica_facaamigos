// lib/evaluation-offer-wave-pure.ts
// Regras PURAS da "1ª onda": o primeiro disparo da oferta de horários a todos os
// pacientes que já esperam a 1ª avaliação com o plano autorizado. É uma exceção
// à regra da data mais próxima (que sugere a partir de AMANHÃ): nesta onda os
// horários só podem cair a partir de uma data piso (`wave_earliest_date`, hoje
// 06/11/2026). Sem import com alias `@/`, para rodar em
// `node --test --experimental-strip-types` (tests/evaluation-offer-wave-pure.test.ts).

import { closedReason, type BusinessHourRow, type ClinicClosure } from "./clinic-calendar-pure.ts";

/** Janela de disparo: seg–sex, das 08h às 18h (nunca de noite nem fim de semana). */
export const DISPATCH_FROM_MIN = 8 * 60;
export const DISPATCH_TO_MIN = 18 * 60;

/**
 * Primeiro dia que pode ser sugerido: amanhã, ou a data piso da onda se ela for
 * mais tarde. Datas civis "YYYY-MM-DD" comparam como texto.
 */
export function effectiveEarliestDate(tomorrow: string, waveFloor: string | null | undefined): string {
  if (!waveFloor || !/^\d{4}-\d{2}-\d{2}$/.test(waveFloor)) return tomorrow;
  return waveFloor > tomorrow ? waveFloor : tomorrow;
}

/**
 * Pode disparar agora? Só em dia útil, dentro de 08h–18h, e com a clínica aberta
 * (feriado nacional ou fechamento cadastrado bloqueiam o dia inteiro).
 * `weekday`: 0 = domingo … 6 = sábado.
 */
export function canDispatchNow(input: {
  date: string;
  minutes: number;
  weekday: number;
  businessHours: BusinessHourRow[];
  closures: ClinicClosure[];
}): { ok: true } | { ok: false; reason: string } {
  if (input.weekday === 0 || input.weekday === 6) return { ok: false, reason: "fim de semana" };
  if (input.minutes < DISPATCH_FROM_MIN || input.minutes >= DISPATCH_TO_MIN) return { ok: false, reason: "fora de 08h–18h" };
  const closed = closedReason(input.date, input.minutes, input.minutes + 1, {
    businessHours: input.businessHours,
    closures: input.closures,
  });
  return closed ? { ok: false, reason: closed.label } : { ok: true };
}

export type WaveCandidate = { patientId: string; patientName: string };

/**
 * Elegíveis da onda: autorizados pelo plano, sem 1ª avaliação marcada, sem
 * oferta (de qualquer status: quem já teve oferta não é reenviado
 * automaticamente, para a onda nunca virar laço) e sem o fluxo do convênio-PDF
 * em andamento. Ordem estável por nome.
 */
export function selectWaveCandidates(input: {
  authorized: WaveCandidate[];
  withEvaluation: Set<string>;
  withOffer: Set<string>;
  withActiveIntakeLead: Set<string>;
}): WaveCandidate[] {
  const seen = new Set<string>();
  return input.authorized
    .filter((c) => {
      if (seen.has(c.patientId)) return false;
      seen.add(c.patientId);
      return !input.withEvaluation.has(c.patientId) && !input.withOffer.has(c.patientId) && !input.withActiveIntakeLead.has(c.patientId);
    })
    .sort((a, b) => a.patientName.localeCompare(b.patientName, "pt-BR"));
}
