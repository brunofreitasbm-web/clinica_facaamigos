/**
 * Regras puras da renovação de guia (pedido ao plano e resposta do plano),
 * usadas pelo assistente em autorizacao-wizard.tsx e pelas actions em
 * authorization-renewal-actions.ts — o servidor revalida o mesmo que a tela.
 */

const DAY_MS = 86_400_000;

function parseDate(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso ? null : t;
}

function toIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Vigência sugerida para a guia nova: começa no dia seguinte ao fim da atual
 * e dura o mesmo número de dias. Se a atual tiver datas inválidas, 90 dias.
 */
export function suggestedRenewalPeriod(prevValidFrom: string, prevValidTo: string): { validFrom: string; validTo: string } {
  const from = parseDate(prevValidFrom);
  const to = parseDate(prevValidTo);
  const start = to !== null ? to + DAY_MS : Date.now();
  const lengthDays = from !== null && to !== null && to >= from ? Math.round((to - from) / DAY_MS) : 89;
  return { validFrom: toIso(start), validTo: toIso(start + lengthDays * DAY_MS) };
}

export type RenewalPeriodInput = { sessions: number; validFrom: string; validTo: string };

/** Mensagem de erro para o usuário, ou null se estiver tudo certo. */
export function validateRenewalPeriod(input: RenewalPeriodInput): string | null {
  if (!Number.isInteger(input.sessions) || input.sessions <= 0) return "Informe a quantidade de sessões (número inteiro maior que zero).";
  if (input.sessions > 999) return "Quantidade de sessões fora do esperado — confira o número.";
  const from = parseDate(input.validFrom);
  const to = parseDate(input.validTo);
  if (from === null || to === null) return "Informe as datas de início e fim da vigência.";
  if (to < from) return "O fim da vigência precisa ser depois do início.";
  return null;
}
