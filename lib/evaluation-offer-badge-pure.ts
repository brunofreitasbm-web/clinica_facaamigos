// lib/evaluation-offer-badge-pure.ts
// Faixa de status do card "Prontos para agendar": em que passo do fluxo
// automático por WhatsApp o responsável está agora. Puro, sem I/O.

export type PoolOfferStatus = "aguardando_interesse" | "aguardando_escolha" | "falhou" | "sem_horario";

export type PoolOffer = {
  id: string;
  status: PoolOfferStatus;
  sentAt: string | null;
  reminderSentAt: string | null;
  lastError: string | null;
};

export type OfferBadge = {
  tone: "amber" | "blue" | "red";
  title: string;
  detail: string;
  /** Oferta viva: agendar manualmente cancela o fluxo automático. */
  live: boolean;
};

/** Mesmo prazo de lib/evaluation-offer.ts (EXPIRE_AFTER_MS) — a oferta expira 48h após o envio. */
const EXPIRE_AFTER_MS = 48 * 60 * 60 * 1000;

/** Oferta ainda esperando o responsável (convite ou escolha do horário). */
export function isLiveOffer(offer: PoolOffer): boolean {
  return offer.status === "aguardando_interesse" || offer.status === "aguardando_escolha";
}

function hoursLabel(hours: number): string {
  return hours < 1 ? "menos de 1 h" : `${hours} h`;
}

export function offerBadge(offer: PoolOffer, nowMs: number): OfferBadge {
  if (offer.status === "falhou" || offer.status === "sem_horario") {
    return {
      tone: "red",
      title: offer.status === "falhou" ? "Automático falhou" : "Sem horário livre",
      detail: offer.lastError ?? "Agende manualmente ou tente de novo.",
      live: false,
    };
  }

  const sentMs = offer.sentAt ? Date.parse(offer.sentAt) : NaN;
  const hasSent = Number.isFinite(sentMs);
  const parts: string[] = [];
  if (hasSent) {
    parts.push(`há ${hoursLabel(Math.max(0, Math.floor((nowMs - sentMs) / 3_600_000)))}`);
    const left = Math.ceil((sentMs + EXPIRE_AFTER_MS - nowMs) / 3_600_000);
    parts.push(left > 0 ? `expira em ${left} h` : "expirando");
  }
  if (offer.reminderSentAt) parts.push("lembrete enviado");

  return offer.status === "aguardando_interesse"
    ? { tone: "amber", title: "Aguardando resposta ao convite", detail: parts.join(" · "), live: true }
    : { tone: "blue", title: "Responsável escolhendo o horário", detail: parts.join(" · "), live: true };
}
