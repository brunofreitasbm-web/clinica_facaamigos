// lib/atendimento/message-author-pure.ts
// Quem enviou cada mensagem do histórico e como mostrar o status de entrega. PURO, sem I/O.
//
// Por que existe: no desktop a bolha do bot e a do operador eram iguais, e o menu mandado pela
// recepção (gravado como `bot`, de propósito, para a família não notar) era indistinguível de
// um menu espontâneo no histórico. `messages.sent_by` resolve a autoria; aqui fica a regra de texto.

export function firstName(full: string | null | undefined): string | null {
  const first = (full ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

type AuthorInput = {
  direction: string;
  senderType: string;
  intent?: string | null;
  /** `messages.sent_by`: profissional da equipe que enviou pelo CRM (NULL: bot, cron ou contato). */
  sentBy?: string | null;
  staffNames: Record<string, string>;
  currentUserId: string | null;
};

const MENU_INTENT = "menu_inicial";

/** Texto discreto de autoria para mensagens ENVIADAS; `null` para o que veio do contato. */
export function messageAuthorLabel(input: AuthorInput): string | null {
  if (input.direction !== "outbound") return null;

  const isMe = Boolean(input.sentBy) && input.sentBy === input.currentUserId;
  const name = input.sentBy ? firstName(input.staffNames[input.sentBy]) : null;

  if (input.senderType === "agent") {
    if (isMe) return "Você";
    return name ?? "Equipe";
  }

  if (input.senderType === "bot") {
    // Menu enviado pela recepção: continua parecendo o bot para a família, mas a equipe sabe quem foi.
    if (input.sentBy && input.intent === MENU_INTENT) {
      if (isMe) return "Menu enviado por você";
      return name ? `Menu enviado por ${name}` : "Menu enviado pela equipe";
    }
    return "Bot";
  }

  if (input.senderType === "system" || input.senderType === "automation") return "Automático";
  return null;
}

export type DeliveryTone = "pending" | "sent" | "delivered" | "read" | "failed";

/** Status de entrega em português. `null` quando não há status; desconhecido não é escondido. */
export function deliveryStatusLabel(status: string | null | undefined): { label: string; tone: DeliveryTone } | null {
  if (!status) return null;
  switch (status) {
    case "queued":
    case "sending":
      return { label: "Enviando", tone: "pending" };
    case "sent":
      return { label: "Enviado", tone: "sent" };
    case "delivered":
      return { label: "Entregue", tone: "delivered" };
    case "read":
      return { label: "Lido", tone: "read" };
    case "failed":
    case "undelivered":
      return { label: "Falhou no envio", tone: "failed" };
    default:
      return { label: status, tone: "pending" };
  }
}
