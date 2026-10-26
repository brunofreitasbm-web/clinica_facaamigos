/**
 * Tipos compartilhados do módulo de Atendimento (inbox WhatsApp via Twilio).
 * Extraído de app/recepcao/atendimento/atendimento-shell.tsx para ser
 * consumido tanto pelo desktop (/recepcao/atendimento) quanto pelo PWA
 * mobile (/m/atendimento) sem duplicar a modelagem de dados.
 */

export type ConversationRow = {
  id: string;
  patientId: string | null;
  /** Status do paciente em `patients.status`. "interessado" = ainda sem
   * avaliação agendada, ou seja, sem prontuário de fato — mesmo já tendo
   * `patientId` preenchido (ver hasPatientRecord). */
  patientStatus: string | null;
  guardianId: string | null;
  phoneNumber: string;
  isBotActive: boolean;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  kind: "patient" | "lead";
  escalationReason: string | null;
  assignedTo: string | null;
  contactName: string | null;
  displayName: string;
  guardianName: string | null;
  planName: string | null;
  planColor: string | null;
  /** Convênio cadastrado que o chatbot identificou (só conta quando a conversa não tem plano de cadastro). */
  insurerId: string | null;
  lastMessagePreview?: string | null;
  /** Última mensagem RECEBIDA do contato — usado para saber se a janela de
   * serviço de 24h do WhatsApp está fechada (ver isWhatsappWindowClosed em
   * app/recepcao/atendimento/atendimento-shell.tsx). */
  lastInboundAt: string | null;
  /** Quem mandou a última mensagem de WhatsApp (trigger
   * trg_conversation_last_sender). `contact` = a bola está com a clínica. */
  lastMessageSender: LastMessageSender | null;
};

export type LastMessageSender = "contact" | "agent" | "bot" | "automation";

export function toLastMessageSender(value: string | null | undefined): LastMessageSender | null {
  return value === "contact" || value === "agent" || value === "bot" || value === "automation" ? value : null;
}

/**
 * true só quando a conversa está de fato ligada a um prontuário — paciente
 * com `patientId` e status além de "interessado" (que é lead com cadastro
 * ainda incompleto, ver 20260906000023_rename_lead_to_interessado.sql).
 * Antes qualquer `patientId` preenchido abria "Ficha do paciente" em vez de
 * "Resolver pendências", mesmo sem prontuário real (ex.: Débora da Costa
 * Soares Monteiro, status "interessado").
 */
export function hasPatientRecord(c: Pick<ConversationRow, "patientId" | "patientStatus">): boolean {
  return Boolean(c.patientId) && c.patientStatus !== "interessado";
}

export type InsurerPill = { name: string; color: string | null };

export type ConversationPatch = Partial<Omit<ConversationRow, "id">>;
