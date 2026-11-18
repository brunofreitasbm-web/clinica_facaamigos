// lib/portal-metodo-pure.ts
// Regras PURAS do Portal da Família para a 2ª etapa do Método FaçaAmigos (Avaliação em Ambiente Natural, no
// Playground) e para o cupom de boas-vindas. Sem import com alias `@/`, para rodar em
// `node --test --experimental-strip-types` (tests/portal-metodo-pure.test.ts).

import { buildWhatsappLink } from "./whatsapp-message.ts";

/** WhatsApp oficial da clínica (mesmo número do site e da TV3). */
export const CLINIC_WHATSAPP = "5591991782027";

/**
 * A 1ª Avaliação (anamnese) já foi REALIZADA? Só realizada conta: agendada ainda não libera o cupom nem o
 * convite. `evaluated_at` é gravado quando a avaliação é resolvida; o status `realizada` cobre o intervalo
 * até o backfill.
 */
export function isAnamneseRealizada(
  patient: { evaluated_at: string | null } | null | undefined,
  evaluationAppointmentStatuses: string[],
): boolean {
  if (patient?.evaluated_at) return true;
  return evaluationAppointmentStatuses.includes("realizada");
}

/** Primeiro nome da criança; "seu filho(a)" quando não há nome (mesma regra da TV3). */
export function childFirstNameOrFallback(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "seu filho(a)";
}

/** Mensagem pronta do botão "Escolher turno no WhatsApp". */
export function buildTurnoWhatsappLink(childName: string): string {
  const msg = `Olá, Isabella! Sobre a avaliação em ambiente natural de ${childName}: o melhor turno para nós é ___ (segunda ou quarta, manhã ou tarde).`;
  return buildWhatsappLink(CLINIC_WHATSAPP, msg);
}

/** Série do Playground "em aberto": existe e ainda não foi concluída nem cancelada. */
export function isSeriesOpen(status: string | null | undefined): boolean {
  return status === "rascunho" || status === "liberada";
}

/**
 * A tela do Método aparece quando a anamnese foi realizada e a Avaliação em Ambiente Natural ainda não
 * terminou (sem série, ou série em aberto). Série concluída/cancelada encerra a etapa.
 */
export function shouldShowMetodo(input: { anamneseRealizada: boolean; seriesStatuses: string[] }): boolean {
  if (!input.anamneseRealizada) return false;
  if (input.seriesStatuses.length === 0) return true;
  return input.seriesStatuses.some(isSeriesOpen);
}

export type VisitLite = { scheduled_start: string; cancelled_at: string | null };

/** Próxima visita do Playground ainda por vir e não cancelada (a mais cedo). */
export function pickNextVisit<T extends VisitLite>(visits: T[], nowMs: number): T | null {
  const future = visits
    .filter((v) => !v.cancelled_at && Date.parse(v.scheduled_start) >= nowMs)
    .sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start));
  return future[0] ?? null;
}

/** Cupom de boas-vindas vale de segunda a quinta (dia civil de Belém). `isoWeekday`: 1 = segunda … 7 = domingo. */
export function welcomeCouponValidOnWeekday(isoWeekday: number): boolean {
  return isoWeekday >= 1 && isoWeekday <= 4;
}
