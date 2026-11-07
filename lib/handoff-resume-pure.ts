// lib/handoff-resume-pure.ts
// Regras PURAS da retomada do fluxo depois de um pedido de atendente. Sem import com
// alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/handoff-resume-pure.test.ts).
//
// Problema: o lead pede atendente no meio do AGENDAR (ou da escolha do horário da 1ª
// avaliação), o bot fica mudo e a etapa se perde. Aqui ficam as decisões de: o que
// guardar, quando oferecer "quer continuar de onde parou?", como ler a resposta e qual
// pergunta repetir. O envio e o banco ficam em lib/handoff-resume.ts.

export const DEFAULT_HANDOFF_RESUME_MINUTES = 15;
export const DEFAULT_PENDING_SLA_MINUTES = 30;

export type ResumeSnapshot = {
  step: string;
  flow: string | null;
  lead_id: string | null;
  collected_data: Record<string, unknown>;
  captured_at: string;
  /** Quando o convite "quer continuar?" saiu (no máximo um por escalonamento). */
  offered_at?: string | null;
};

export type SessionRow = {
  current_step: string | null;
  flow: string | null;
  lead_id?: string | null;
  collected_data?: Record<string, unknown> | null;
};

const EVAL_OFFER_FLOW = "eval_offer";
const EVAL_STEPS = new Set(["eval_offer_awaiting_interest", "eval_offer_awaiting_choice"]);

/** Etapas do AGENDAR em que a família ainda está respondendo (as depois do envio não voltam). */
const AGENDAR_STEPS = new Set([
  "awaiting_guardian_name",
  "awaiting_child_name",
  "awaiting_child_birth_date",
  "awaiting_plan",
  "awaiting_therapies",
  "awaiting_documents",
  "awaiting_laudo",
  "awaiting_carteirinha",
  "awaiting_carteirinha_verso",
  "awaiting_documento_identidade",
  "awaiting_card_number",
]);

/** A sessão está numa etapa que vale retomar depois do atendente? */
export function isResumableSession(session: SessionRow | null | undefined): boolean {
  if (!session) return false;
  const step = session.current_step ?? "";
  if (session.flow === EVAL_OFFER_FLOW) return EVAL_STEPS.has(step);
  if (session.flow) return false;
  return AGENDAR_STEPS.has(step);
}

/** Foto da sessão a guardar no escalonamento; `null` quando não há o que retomar. */
export function buildResumeSnapshot(session: SessionRow | null | undefined, nowIso: string): ResumeSnapshot | null {
  if (!session || !isResumableSession(session)) return null;
  return {
    step: session.current_step as string,
    flow: session.flow ?? null,
    lead_id: session.lead_id ?? null,
    collected_data: session.collected_data ?? {},
    captured_at: nowIso,
    offered_at: null,
  };
}

export type ResumeOfferInput = {
  snapshot: ResumeSnapshot | null | undefined;
  /** Conversa escalada (`escalated_at`). */
  escalatedAt: string | null | undefined;
  nowMs: number;
  minutes: number | null | undefined;
  /** Última mensagem de um humano (sender_type agent) na conversa, se houver. */
  lastHumanOutboundAt: string | null | undefined;
  /** Atendimento aberto com atendente já atribuído/respondendo. */
  humanAttending: boolean;
  withinBusinessHours: boolean;
  windowOpen: boolean;
};

export type ResumeOfferDecision = { offer: boolean; reason: string };

/**
 * Oferece a retomada só quando é seguro: sem humano falando (nem agora, nem desde o
 * escalonamento), em horário comercial, com a janela de 24h aberta, depois de X minutos
 * e uma única vez por escalonamento.
 */
export function decideResumeOffer(input: ResumeOfferInput): ResumeOfferDecision {
  const minutes = input.minutes ?? 0;
  if (!(minutes > 0)) return { offer: false, reason: "desligado" };
  if (!input.snapshot) return { offer: false, reason: "sem_etapa" };
  if (input.snapshot.offered_at) return { offer: false, reason: "ja_ofereceu" };
  const escalated = input.escalatedAt ? Date.parse(input.escalatedAt) : NaN;
  if (!Number.isFinite(escalated)) return { offer: false, reason: "sem_escalonamento" };
  if (input.nowMs - escalated < minutes * 60_000) return { offer: false, reason: "cedo_demais" };
  if (input.humanAttending) return { offer: false, reason: "humano_atendendo" };
  const human = input.lastHumanOutboundAt ? Date.parse(input.lastHumanOutboundAt) : NaN;
  if (Number.isFinite(human) && human >= escalated) return { offer: false, reason: "humano_respondeu" };
  if (!input.withinBusinessHours) return { offer: false, reason: "fora_do_horario" };
  if (!input.windowOpen) return { offer: false, reason: "janela_fechada" };
  return { offer: true, reason: "ok" };
}

export type PendingSlaInput = {
  escalatedAt: string | null | undefined;
  nowMs: number;
  minutes: number | null | undefined;
  lastHumanOutboundAt: string | null | undefined;
  humanAttending: boolean;
  withinBusinessHours: boolean;
  alreadyNotified: boolean;
};

/** Conversa `pending` esperando humano além do SLA, em horário comercial, ainda não avisada. */
export function shouldAlertPendingSla(input: PendingSlaInput): boolean {
  const minutes = input.minutes ?? 0;
  if (!(minutes > 0) || input.alreadyNotified || input.humanAttending || !input.withinBusinessHours) return false;
  const escalated = input.escalatedAt ? Date.parse(input.escalatedAt) : NaN;
  if (!Number.isFinite(escalated) || input.nowMs - escalated < minutes * 60_000) return false;
  const human = input.lastHumanOutboundAt ? Date.parse(input.lastHumanOutboundAt) : NaN;
  return !(Number.isFinite(human) && human >= escalated);
}

export type ResumeReply = "yes" | "menu" | "other";

/** Leitura da resposta ao convite: SIM continua, MENU/NÃO volta às opções, o resto segue o fluxo normal. */
export function parseResumeReply(raw: string | null | undefined): ResumeReply {
  const text = (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.split(" ").length > 4) return "other";
  if (/^(sim|s|claro|quero|pode|pode ser|vamos|bora|continuar|continua|seguir|segue|ok|isso|1)( (por favor|pfv|continuar))?$/.test(text)) return "yes";
  if (/^(menu|voltar|volta|nao|n|nao quero|depois|agora nao|0|2)$/.test(text)) return "menu";
  return "other";
}

export const RESUME_OFFER_TEXT =
  "Oi! 💙 A nossa equipe já vai te atender por aqui. Enquanto isso, quer continuar de onde paramos?\n\n" +
  "Responda *SIM* para continuar ou *MENU* para ver as opções.";

export const RESUME_YES_INTRO = "Combinado! 💙 Vamos continuar de onde paramos.";

export const OUT_OF_RESUME_REPLY =
  "Tudo bem! 💙 A equipe segue com o seu atendimento. Para ver as opções, responda *MENU*.";

export const PENDING_WAIT_REPLY =
  "Oi! 💙 Ainda estamos com a sua conversa na fila da recepção e já retornamos por aqui. Obrigada por aguardar!";

/** Pergunta a repetir ao restaurar a etapa (as etapas de documento pedem o arquivo de novo). */
export function resumeQuestionFor(step: string, data: Record<string, unknown> | null | undefined): string {
  const child = typeof data?.child_name === "string" && data.child_name.trim() ? (data.child_name as string).trim() : "a criança";
  switch (step) {
    case "awaiting_guardian_name":
      return "Qual o seu *nome completo* (responsável)?";
    case "awaiting_child_name":
      return "Qual o *nome completo da criança ou adolescente* que fará a avaliação?";
    case "awaiting_child_birth_date":
      return `Qual a *data de nascimento* de ${child}? (DD/MM/AAAA)`;
    case "awaiting_plan":
      return "Qual é o *plano de saúde*? Se o atendimento for *particular*, responda PARTICULAR.";
    case "awaiting_therapies":
      return `Quais terapias você procura para ${child}? Pode escrever (ex.: fonoaudiologia, psicologia) ou responder *NÃO SEI*.`;
    case "awaiting_documents":
      return "Pode enviar agora a foto ou PDF dos documentos que faltam (laudo, carteirinha e RG ou CNH). Quando terminar, responda *PRONTO*.";
    case "awaiting_laudo":
      return "Envie a foto ou PDF do *laudo* (ou responda *NÃO TENHO*).";
    case "awaiting_carteirinha":
      return "Envie a foto da *carteirinha do plano* (frente e verso) ou um PDF com as duas páginas.";
    case "awaiting_carteirinha_verso":
      return "Envie a foto do *verso* da carteirinha (ou responda *NÃO TENHO*).";
    case "awaiting_documento_identidade":
      return "Envie a foto do *RG ou CNH* do responsável.";
    case "awaiting_card_number":
      return "Qual o *número da carteirinha* do plano?";
    default:
      return "";
  }
}
