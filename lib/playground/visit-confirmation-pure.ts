// Mensagem de confirmação de agendamento enviada pela operadora via WhatsApp (wa.me).
// Puro, sem I/O. Não usa a palavra "playground" na conversa com a família.
import { buildWhatsappLink } from "../whatsapp-message.ts";
import { pickEvaluationRecipient, type GuardianContact } from "../evaluation-recipient-pure.ts";

/** Como a família reconhece cada unidade (nome + ponto de referência). Chave: nome da unidade no sistema. */
const UNIT_PLACE: Record<string, string> = {
  "Bosque Grão-Pará": "Bosque Grão-Pará, de frente para a Loja Renner",
  "Parque Shopping": "Parque Shopping, próximo às Lojas Americanas",
};

export function unitPlaceDescription(unitName: string): string {
  return UNIT_PLACE[unitName] ?? unitName;
}

/** "terça-feira, 18/11" e "14:00" no fuso da clínica. */
export function formatConfirmationWhen(scheduledStartIso: string, timeZone: string): { dateLabel: string; time: string } {
  const d = new Date(scheduledStartIso);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "long" }).format(d);
  const dm = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { dateLabel: `${weekday}, ${dm}`, time };
}

/** "dd/mm HH:mm" no fuso da clínica (rótulo de "confirmação aberta em"). */
export function formatSentAt(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const dm = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${dm} ${time}`;
}

export function buildVisitConfirmationMessage(params: {
  guardianName?: string | null;
  patientName: string;
  dateLabel: string;
  time: string;
  unitName: string;
}): string {
  const first = (params.guardianName ?? "").trim().split(/\s+/)[0];
  const greeting = first ? `Olá, ${first}! 💙` : "Olá! 💙";
  return `${greeting} Passando para confirmar o agendamento de ${params.patientName.trim()} na FaçaAmigos: ${params.dateLabel}, às ${params.time}, no ${unitPlaceDescription(params.unitName)}. Estamos ansiosos para receber vocês! 🤗 Qualquer dúvida, é só chamar por aqui.`;
}

/** Link wa.me pronto, ou null quando nenhum responsável tem telefone. */
export function buildVisitConfirmationLink(params: {
  guardians: GuardianContact[];
  patientName: string;
  scheduledStartIso: string;
  unitName: string;
  timeZone: string;
}): string | null {
  const recipient = pickEvaluationRecipient(params.guardians);
  if (!recipient) return null;
  const { dateLabel, time } = formatConfirmationWhen(params.scheduledStartIso, params.timeZone);
  const message = buildVisitConfirmationMessage({
    guardianName: recipient.name,
    patientName: params.patientName,
    dateLabel,
    time,
    unitName: params.unitName,
  });
  return buildWhatsappLink(recipient.phone, message);
}
