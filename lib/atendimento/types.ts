/**
 * Tipos compartilhados do módulo de Atendimento (inbox WhatsApp via Twilio).
 * Extraído de app/recepcao/atendimento/atendimento-shell.tsx para ser
 * consumido tanto pelo desktop (/recepcao/atendimento) quanto pelo PWA
 * mobile (/m/atendimento) sem duplicar a modelagem de dados.
 */

export type ConversationRow = {
  id: string;
  patientId: string | null;
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
};

export type InsurerPill = { name: string; color: string | null };

export type ConversationPatch = Partial<Omit<ConversationRow, "id">>;
