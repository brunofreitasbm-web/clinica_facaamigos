// lib/menu-reset-pure.ts
// Regra PURA: quem ficou muito tempo sem escrever recebe o menu inicial do zero,
// e qualquer sessão de fluxo esquecida (AGENDAR, pré-anamnese, acolhimento...) é
// descartada. Sem import com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/menu-reset-pure.test.ts).
//
// Por que existe: uma sessão `awaiting_has_laudo` parada há 6 semanas capturava o
// "Oi" da pessoa antes de o menu ser avaliado e repetia "envie o laudo".

/** Silêncio do CONTATO (última mensagem recebida) a partir do qual o menu volta do zero. */
export const MENU_RESET_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Fluxo da oferta automática de horários da 1ª avaliação (lib/evaluation-offer.ts). */
const OFFER_FLOW = "eval_offer";

/** Etapas em que a bola está com a equipe, não com a família: nunca descartar. */
const STAFF_OWNED_STEPS = new Set(["intake_pending_supervisor"]);

/**
 * O contato ficou mais de `windowMs` sem escrever? `previousInboundAt` é a mensagem
 * recebida ANTERIOR à atual. Sem registro (primeiro contato), `false`: quem chega
 * pela primeira vez já cai na regra normal de boas-vindas.
 */
export function isInactiveForMenuReset(
  previousInboundAt: string | null | undefined,
  nowMs: number,
  windowMs: number = MENU_RESET_WINDOW_MS,
): boolean {
  if (!previousInboundAt) return false;
  const previous = Date.parse(previousInboundAt);
  if (!Number.isFinite(previous)) return false;
  return nowMs - previous > windowMs;
}

/** A sessão do telefone está presa num fluxo que pode ser descartado com segurança? */
export function shouldDiscardSession(session: { current_step: string | null; flow: string | null } | null | undefined): boolean {
  if (!session) return false;
  const step = session.current_step ?? "";
  if (!step || step === "idle" || step === "completed") return false;
  if (session.flow === OFFER_FLOW) return false;
  if (STAFF_OWNED_STEPS.has(step)) return false;
  return true;
}
