import { civilDateInTimeZone } from "../timezone.ts";
import { PLAYGROUND_FUTURE_SKEW_SECONDS } from "./constants.ts";

/**
 * A avaliação não pode passar para outro dia: uma entrada só vale se o
 * terapeuta a salvou no mesmo dia civil da visita. Usa `saved_at` (carimbado
 * no PDV e assinado), não a hora em que a entrada chegou à clínica, para que
 * uma entrada salva às 18h que ficou na fila e chegou no dia seguinte ainda
 * valha.
 */
export function isSavedOnVisitDay(savedAt: string, visitScheduledStart: string, timeZone: string): boolean {
  const saved = new Date(savedAt);
  const visit = new Date(visitScheduledStart);
  if (isNaN(saved.getTime()) || isNaN(visit.getTime())) return false;
  return civilDateInTimeZone(saved, timeZone) === civilDateInTimeZone(visit, timeZone);
}

/** Rejeita `saved_at` muito à frente do relógio do servidor (relógio do tablet errado). */
export function isSavedAtPlausible(savedAt: string, now: Date): boolean {
  const saved = new Date(savedAt).getTime();
  if (isNaN(saved)) return false;
  return saved <= now.getTime() + PLAYGROUND_FUTURE_SKEW_SECONDS * 1000;
}
