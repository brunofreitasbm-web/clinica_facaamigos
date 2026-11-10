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

export type MenuResetInput = {
  /** Mensagem recebida ANTERIOR à atual (`last_inbound_at` antes do update). */
  previousInboundAt: string | null | undefined;
  /** Última mensagem enviada PELA CLÍNICA (bot, atendente, template ou cron) na conversa. */
  lastClinicOutboundAt: string | null | undefined;
  /** A mensagem atual é um toque em botão ou item de lista (ButtonPayload/ListId). */
  hasInteractiveReply: boolean;
  session: { current_step: string | null; flow: string | null } | null | undefined;
  /** `chatbot_sessions.updated_at`; ausente = tratada como velha. */
  sessionUpdatedAt: string | null | undefined;
  nowMs: number;
  windowMs?: number;
};

export type MenuResetDecision = { sendMenu: boolean; discardSession: boolean };

/**
 * Decide o reinício do menu depois de silêncio longo. Só reinicia quando a pessoa
 * está COMEÇANDO do zero. Nunca quando ela está respondendo a algo que a clínica
 * mandou há pouco (template de plano autorizado, oferta de horários, aviso de
 * falta...): nesse caso o menu engolia o toque no botão e a família tinha de
 * tocar de novo (caso real de 09/11: 8 de 10 famílias).
 */
export function decideMenuReset(input: MenuResetInput): MenuResetDecision {
  const none: MenuResetDecision = { sendMenu: false, discardSession: false };
  const windowMs = input.windowMs ?? MENU_RESET_WINDOW_MS;

  // Toque em botão/lista é sempre resposta a uma mensagem nossa.
  if (input.hasInteractiveReply) return none;
  if (!isInactiveForMenuReset(input.previousInboundAt, input.nowMs, windowMs)) return none;

  // A clínica falou depois do silêncio do contato, dentro da janela: é a resposta a nós.
  const outbound = input.lastClinicOutboundAt ? Date.parse(input.lastClinicOutboundAt) : NaN;
  if (Number.isFinite(outbound) && input.nowMs - outbound < windowMs) return none;

  const session = input.session;
  const step = session?.current_step ?? "";
  const hasActiveStep = Boolean(step) && step !== "idle" && step !== "completed";
  if (session && hasActiveStep) {
    // Sessão da oferta de horários ou da supervisão: a bola não está com a família.
    if (!shouldDiscardSession(session)) return none;
    // Sessão mexida há pouco não é "esquecida": não mexe nela.
    const updated = input.sessionUpdatedAt ? Date.parse(input.sessionUpdatedAt) : NaN;
    if (Number.isFinite(updated) && input.nowMs - updated < windowMs) return none;
    return { sendMenu: true, discardSession: true };
  }

  return { sendMenu: true, discardSession: false };
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
