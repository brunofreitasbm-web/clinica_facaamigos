/**
 * Alerta (pop-up) de venda particular. PURO (sem I/O).
 *
 * Quando a família pede para agendar a avaliação particular
 * (`escalation_reason = particular_agendar`), supervisão e recepção precisam
 * ver isso em qualquer tela — não só quem está no Atendimento (a pílula da
 * lista de conversas, ver priority-pure.ts, só aparece lá). O alerta fica
 * enquanto a conversa estiver pendente, sem dono e sem paciente vinculado;
 * assumir, marcar como particular ou encerrar a conversa o remove.
 */

export const PARTICULAR_SALE_REASON = "particular_agendar";

export type ParticularAlertConversation = {
  id: string;
  status: string;
  escalationReason: string | null;
  assignedTo: string | null;
  patientId: string | null;
  contactName: string | null;
  phoneNumber: string;
};

type AlertInput = Pick<ParticularAlertConversation, "status" | "escalationReason" | "assignedTo" | "patientId">;

export function isParticularSaleAlert(c: AlertInput): boolean {
  return (
    c.status === "pending" && c.escalationReason === PARTICULAR_SALE_REASON && !c.assignedTo && !c.patientId
  );
}

/** Aplica uma mudança de conversa (evento realtime) à lista do alerta, sem duplicar. */
export function applyConversationChange(
  list: ParticularAlertConversation[],
  changed: ParticularAlertConversation,
): ParticularAlertConversation[] {
  const rest = list.filter((c) => c.id !== changed.id);
  if (!isParticularSaleAlert(changed)) return rest;
  const previous = list.find((c) => c.id === changed.id);
  return previous ? list.map((c) => (c.id === changed.id ? changed : c)) : [...rest, changed];
}
