// lib/atendimento/sections-pure.ts
// Seções da lista de conversas do Chat (desktop e celular). PURO, sem I/O.
//
// Por que existe: a fila misturava quem espera a equipe com quem o bot já resolve, e o
// operador precisava ler cada item para achar a próxima conversa. Agora a lista responde
// primeiro "o que precisa de MIM agora?".
//
//  • Precisa de você  — prioridade, ou aguardando resposta humana sem dono (ou comigo).
//  • Em atendimento   — com alguém da equipe, ou escalada/humano no controle sem espera.
//  • Com o bot        — o bot está conduzindo; a equipe só acompanha.

import { isPriorityEscalation } from "./priority-pure.ts";
import { waitingSince } from "./waiting.ts";
import type { ConversationRow } from "./types.ts";

export type SectionKey = "precisa" | "atendimento" | "bot";

export const SECTION_LABELS: Record<SectionKey, string> = {
  precisa: "Precisa de você",
  atendimento: "Em atendimento",
  bot: "Com o bot",
};

const SECTION_ORDER: SectionKey[] = ["precisa", "atendimento", "bot"];

type SectionInput = Pick<
  ConversationRow,
  "status" | "escalationReason" | "assignedTo" | "isBotActive" | "lastMessageSender" | "lastInboundAt" | "lastMessageAt"
>;

/** Seção de uma conversa ABERTA. Conversas encerradas não passam por aqui (filtro "Encerradas" é plano). */
export function sectionOf(c: SectionInput, currentUserId: string | null): SectionKey {
  if (isPriorityEscalation(c)) return "precisa";

  const ownedByOther = Boolean(c.assignedTo) && c.assignedTo !== currentUserId;
  const humanInvolved = c.status === "pending" || !c.isBotActive;

  // Só conta como "precisa de você" quando um HUMANO deveria responder. Contato esperando
  // enquanto o bot ainda conduz não entra: o bot responde em segundos e a seção virava ruído.
  if (humanInvolved && !ownedByOther && waitingSince(c) !== null) return "precisa";

  if (c.assignedTo || humanInvolved) return "atendimento";
  return "bot";
}

export type ConversationSection<T> = { key: SectionKey; label: string; rows: T[] };

/**
 * Agrupa e ordena. Dentro de "Precisa de você": prioridade primeiro e, depois, quem espera
 * há MAIS tempo (fila justa: o mais antigo não fica para trás). Nas demais seções mantém a
 * ordem recebida (última mensagem primeiro). Seções vazias não aparecem.
 */
export function sectionConversations<T extends SectionInput>(
  rows: T[],
  currentUserId: string | null,
): ConversationSection<T>[] {
  const buckets: Record<SectionKey, T[]> = { precisa: [], atendimento: [], bot: [] };
  for (const row of rows) buckets[sectionOf(row, currentUserId)].push(row);

  const waitStart = (c: T): number => {
    const iso = waitingSince(c) ?? c.lastMessageAt;
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };
  // Array.prototype.sort é estável: empates preservam a ordem recebida.
  buckets.precisa = [...buckets.precisa].sort((a, b) => {
    const pa = isPriorityEscalation(a) ? 0 : 1;
    const pb = isPriorityEscalation(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return waitStart(a) - waitStart(b);
  });

  return SECTION_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    label: SECTION_LABELS[key],
    rows: buckets[key],
  }));
}

/** Limite padrão (min) para o item ficar vermelho quando a configuração não existe ou desliga o SLA. */
export const DEFAULT_WAIT_ALERT_MINUTES = 15;

/**
 * Minutos de espera a partir dos quais o item fica vermelho. Segue `pending_sla_minutes`
 * (o mesmo que o backend usa para avisar a equipe); 0, ausente ou inválido volta ao padrão,
 * porque desligar o aviso do backend não deve apagar o sinal visual da tela.
 */
export function waitAlertMinutes(configured: number | null | undefined): number {
  return typeof configured === "number" && Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_WAIT_ALERT_MINUTES;
}
