// lib/evaluation-offer-session-pure.ts
// Regra PURA: o telefone está livre para receber a oferta da 1ª avaliação? Sem import com
// alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/evaluation-offer-session-pure.test.ts).

/**
 * Sessão de outro fluxo parada há mais que isso não conta como "atendimento em andamento":
 * passou a janela de 24h do WhatsApp, a família já não está respondendo. Sem isso, sessões
 * esquecidas (ex.: `awaiting_slot_selection` do bot de anamnese) bloqueavam a oferta para sempre.
 */
export const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

export function isPhoneFreeForOffer(
  session: { current_step: string | null; flow: string | null; updated_at: string | null } | null,
  offerFlow: string,
  nowMs: number,
): boolean {
  if (!session) return true;
  if (["idle", "completed"].includes(session.current_step ?? "idle")) return true;
  if (session.flow === offerFlow) return true;
  const updated = session.updated_at ? Date.parse(session.updated_at) : NaN;
  return Number.isFinite(updated) && nowMs - updated > STALE_SESSION_MS;
}
