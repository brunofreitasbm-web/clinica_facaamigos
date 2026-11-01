/**
 * Prioridade de atendimento na fila do WhatsApp. PURO (sem I/O).
 *
 * Uma conversa é "prioridade" quando a família sinalizou intenção de comprar o
 * atendimento particular (mandou os dados para agendar) ou pediu para falar
 * com um humano, e ninguém da equipe assumiu ainda. Assumir a conversa
 * (`assignedTo`) ou respondê-la (status deixa de ser `pending`) encerra o
 * destaque.
 */

export const PRIORITY_REASONS = ["particular_agendar", "pediu_humano"] as const;

type PriorityInput = { status: string; escalationReason: string | null; assignedTo: string | null };

export function isPriorityEscalation(c: PriorityInput): boolean {
  return (
    c.status === "pending" &&
    !c.assignedTo &&
    (PRIORITY_REASONS as readonly string[]).includes(c.escalationReason ?? "")
  );
}

export function priorityLabel(reason: string | null): string {
  return reason === "pediu_humano" ? "Prioridade · Pediu humano" : "Prioridade · Particular";
}

/** Prioridades primeiro; dentro de cada grupo mantém a ordem recebida (já por última mensagem). */
export function prioritizeConversations<T extends PriorityInput>(rows: T[]): T[] {
  return [...rows.filter(isPriorityEscalation), ...rows.filter((c) => !isPriorityEscalation(c))];
}
