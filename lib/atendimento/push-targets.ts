/**
 * Regra pura de "quem avisar" quando chega mensagem do contato numa conversa
 * que o bot não vai responder. Sem I/O pra ser testável (tests/push-targets-pure.test.ts).
 */

export const PUSH_DEBOUNCE_MS = 3 * 60_000;

export function shouldNotify(input: {
  botActive: boolean;
  botEnabled: boolean;
  lastPushAt: string | null;
  now: Date;
}): boolean {
  // Bot cuidando da conversa: ninguém precisa ser acordado.
  if (input.botActive && input.botEnabled) return false;
  if (input.lastPushAt) {
    const last = Date.parse(input.lastPushAt);
    if (Number.isFinite(last) && input.now.getTime() - last < PUSH_DEBOUNCE_MS) return false;
  }
  return true;
}

/** Atribuída → só a pessoa responsável (se ela tiver aparelho inscrito); senão, todos os inscritos. */
export function selectPushUserIds(input: { assignedTo: string | null; subscribedUserIds: string[] }): string[] {
  const unique = Array.from(new Set(input.subscribedUserIds));
  if (input.assignedTo && unique.includes(input.assignedTo)) return [input.assignedTo];
  return unique;
}
