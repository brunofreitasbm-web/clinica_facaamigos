// lib/insurance-intake-stale.ts
// Sinaliza acolhimentos "parados" no meio do fluxo automático (bot
// aguardando resposta da família, ou supervisor com uma validação
// pendente) — usado pela planilha de supervisão para avisar quando uma
// ação manual provavelmente é necessária.

const THRESHOLD_HOURS: Record<string, number> = {
  awaiting_documents: 48,
  pending_supervisor: 24,
  awaiting_slot: 48,
  pending_confirmation: 24,
};

const REFERENCE_FIELD: Record<string, keyof IntakeStaleTimestamps> = {
  awaiting_documents: "contact_sent_at",
  pending_supervisor: "last_file_at",
  awaiting_slot: "slots_sent_at",
  pending_confirmation: "scheduled_at",
};

const MESSAGE_BY_STATUS: Record<string, (elapsed: string) => string> = {
  awaiting_documents: (elapsed) => `Sem retorno da família há ${elapsed} — considere ligar ou reenviar o link do WhatsApp.`,
  pending_supervisor: (elapsed) => `Documentos aguardando validação há ${elapsed} — ação do supervisor.`,
  awaiting_slot: (elapsed) => `Família não escolheu horário há ${elapsed} — considere ligar.`,
  pending_confirmation: (elapsed) => `Horário escolhido aguardando confirmação do supervisor há ${elapsed}.`,
};

export type IntakeStaleTimestamps = {
  contact_sent_at: string | null;
  last_file_at: string | null;
  slots_sent_at: string | null;
  scheduled_at: string | null;
};

function formatElapsed(hours: number): string {
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} dia${days > 1 ? "s" : ""}`;
  return `${Math.max(1, Math.floor(hours))}h`;
}

/** Retorna o texto de alerta se o lead está parado além do prazo esperado para seu status atual, ou null. */
export function computeIntakeStaleWarning(status: string, timestamps: IntakeStaleTimestamps, now: Date = new Date()): string | null {
  const thresholdHours = THRESHOLD_HOURS[status];
  if (!thresholdHours) return null;

  const field = REFERENCE_FIELD[status];
  const refTs = timestamps[field];
  if (!refTs) return null;

  const hoursStale = (now.getTime() - new Date(refTs).getTime()) / (1000 * 60 * 60);
  if (hoursStale < thresholdHours) return null;

  return MESSAGE_BY_STATUS[status](formatElapsed(hoursStale));
}
