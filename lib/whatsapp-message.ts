/**
 * Geração de mensagem e link de envio manual via WhatsApp (Web/App já logado
 * no aparelho da recepção). Não depende de Meta Cloud API / Z-API: o clique
 * abre `wa.me` com o texto pré-preenchido, a recepção só aperta enviar.
 */

export function buildD1ReminderMessage(params: {
  guardianName: string;
  patientName: string;
  discipline: string;
  appointmentDate: string; // já formatado dd/mm
  appointmentTime: string; // já formatado HH:mm
  roomName: string;
}): string {
  const { guardianName, patientName, discipline, appointmentDate, appointmentTime, roomName } = params;
  return `Olá ${guardianName}! Confirmamos a sessão de ${discipline} de ${patientName} amanhã (${appointmentDate}) às ${appointmentTime} na ${roomName}. Responda *1* para CONFIRMAR ou *2* para REAGENDAR.`;
}

const LOWERCASE_WORDS = new Set(["e", "de", "da", "do", "das", "dos", "em", "a", "o"]);
const KEEP_UPPERCASE = new Set(["aba", "i", "ii", "iii"]);

/** "FONOAUDIOLOGIA - MÉTODO ABA - CLÍNICO" → "Fonoaudiologia - Método ABA" (nome do jeito que a família lê). */
function friendlyProcedureName(description: string): string {
  const withoutSetting = description.replace(/\s*-?\s*CL[ÍI]NICO\s*$/i, "").trim();
  return withoutSetting
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (KEEP_UPPERCASE.has(lower)) return lower.toUpperCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.replace(/^[(]?\p{L}/u, (c) => c.toLocaleUpperCase("pt-BR"));
    })
    .join(" ");
}

function quantityLabel(description: string, quantity: number): string {
  if (/PACOTE/i.test(description)) return `${quantity} ${quantity === 1 ? "pacote" : "pacotes"}`;
  return `${quantity} ${quantity === 1 ? "sessão" : "sessões"}`;
}

export type PlanAuthorizedProcedure = { description: string; quantity: number };

/**
 * Aviso acolhedor de que o plano autorizou o atendimento, com as terapias e as
 * quantidades da guia e o aviso de que o agendamento já está liberado. Sai do
 * WhatsApp pessoal da recepção (wa.me), não do bot do CRM. Sem valores.
 */
export function buildPlanAuthorizedMessage(params: {
  guardianName: string | null;
  patientName: string | null;
  procedures: PlanAuthorizedProcedure[];
  /** Validade da guia, ISO yyyy-mm-dd. */
  validUntil?: string | null;
}): string {
  const greeting = params.guardianName ? `Olá, ${params.guardianName}! 💙` : "Olá! 💙";
  const child = params.patientName ? `de ${params.patientName}` : "da criança";
  const list = params.procedures
    .map((p) => `• ${friendlyProcedureName(p.description) || "Atendimento"} — ${quantityLabel(p.description, p.quantity)}`)
    .join("\n");
  const validity = params.validUntil ? `\n\nA autorização é válida até ${params.validUntil.split("-").reverse().join("/")}.` : "";
  const authorized = list ? `O que foi autorizado:\n${list}` : "";
  return `${greeting} Passando para trazer uma ótima notícia: o plano de saúde autorizou o atendimento ${child} na Clínica FaçaAmigos! 🎉\n\n${authorized}${validity}\n\nCom a autorização em mãos, o agendamento da primeira avaliação já está liberado. Em breve nossa equipe entra em contato para combinar o melhor dia e horário com você. Qualquer dúvida, é só nos chamar por aqui. Estamos muito felizes em receber vocês! 🤗`;
}

/** Normaliza telefone BR pra formato E.164 sem "+" (o que o wa.me espera). */
export function normalizeBrazilianPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function buildWhatsappLink(rawPhone: string, message: string): string {
  const phone = normalizeBrazilianPhone(rawPhone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

function greeting(guardianName: string | null | undefined): string {
  const name = firstName(guardianName);
  return name ? `Olá ${name}!` : "Olá!";
}

/** Aviso manual (wa.me) de que o plano autorizou a 1ª avaliação. */
export function buildAuthorizationApprovedMessage(params: {
  guardianName?: string | null;
  patientName?: string | null;
  insurerName?: string | null;
}): string {
  const plan = params.insurerName?.trim() ? `o plano ${params.insurerName.trim()}` : "o plano";
  const patient = params.patientName?.trim() ? ` de ${params.patientName.trim()}` : "";
  return `${greeting(params.guardianName)} Boa notícia: ${plan} autorizou a avaliação${patient}. 💙 Em breve entramos em contato para combinar o melhor horário.`;
}

/** Aviso manual (wa.me) de que a renovação da guia saiu. `validTo` em AAAA-MM-DD. */
export function buildRenewalApprovedMessage(params: {
  guardianName?: string | null;
  patientName?: string | null;
  insurerName?: string | null;
  sessions?: number | null;
  validTo?: string | null;
}): string {
  const plan = params.insurerName?.trim() ? `o plano ${params.insurerName.trim()}` : "o plano";
  const patient = params.patientName?.trim() ? ` de ${params.patientName.trim()}` : "";
  const sessions = params.sessions && params.sessions > 0 ? `${params.sessions} sessões` : "novas sessões";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.validTo ?? "");
  const until = iso ? `, válidas até ${iso[3]}/${iso[2]}/${iso[1]}` : "";
  return `${greeting(params.guardianName)} Boa notícia: ${plan} autorizou a renovação da guia${patient}: ${sessions}${until}. 💙 As sessões seguem normalmente.`;
}
