// lib/whatsapp/copy.ts
/**
 * Todo o texto PT-BR do chatbot, como funções puras — nada aqui toca banco
 * ou rede, pra dar pra testar isoladamente e pra nunca ter string solta
 * espalhada por bot.ts (mesmo espírito de lib/whatsapp-message.ts).
 */

export const MENU_TEXT = `Olá! 👋 Sou a assistente virtual da Clínica Faça Amigos. Posso ajudar com:
1️⃣ Agendar avaliação (já autorizada pelo plano)
2️⃣ Convênios aceitos
3️⃣ Documentos necessários
4️⃣ Como funciona a avaliação
5️⃣ Endereço e horário
6️⃣ Confirmar ou reagendar uma sessão
9️⃣ Falar com uma pessoa da equipe

Digite o número da opção. A qualquer momento, *0* volta ao menu.`;

export const NOT_UNDERSTOOD_TEXT =
  "Não entendi 🤔. Aqui está o menu de novo:\n\n" + MENU_TEXT;

export function insurersInfoText(insurerNames: string[]): string {
  if (insurerNames.length === 0) {
    return "No momento não temos convênios cadastrados no sistema — fale com a recepção (opção 9) para confirmar seu plano.";
  }
  return `Convênios aceitos atualmente:\n${insurerNames.map((n) => `• ${n}`).join("\n")}\n\nTambém atendemos particular. Digite *0* para voltar ao menu.`;
}

export const DOCUMENTS_INFO_TEXT = `Para a avaliação/anamnese pelo convênio, você vai precisar de:
• Laudo médico com indicação de terapia multidisciplinar
• Guia/autorização do convênio para a avaliação
• Carteirinha do convênio (se houver)
• Documento de identidade do responsável

Digite *1* no menu para começar o agendamento, ou *0* para voltar.`;

export const EVALUATION_INFO_TEXT = `A avaliação/anamnese é uma conversa inicial com a coordenação da clínica, com duração aproximada de 1 hora. Nela entendemos a história da criança, a queixa da família e organizamos o plano terapêutico.

Leve o laudo médico e a guia do convênio impressos (ou por PDF, se já enviou por aqui) no dia da avaliação.

Digite *0* para voltar ao menu.`;

export function addressInfoText(address: string | null, openingHours: string | null): string {
  const lines = [
    address ? `📍 ${address}` : "Endereço ainda não cadastrado — fale com a recepção (opção 9).",
    openingHours ? `🕐 ${openingHours}` : null,
  ].filter(Boolean);
  return `${lines.join("\n")}\n\nDigite *0* para voltar ao menu.`;
}

export const CONSENT_TEXT = `Para agendar, vou precisar de alguns dados seus e da criança, além do laudo e da guia do convênio. Eles são usados só para o atendimento na clínica e ficam protegidos conforme a LGPD.

Você autoriza? 1️⃣ Sim, autorizo · 2️⃣ Não`;

export const CONSENT_DECLINED_TEXT = `Tudo bem. Sem esses dados não conseguimos agendar por aqui, mas você pode falar com a recepção.

9️⃣ Falar com uma pessoa da equipe · 0️⃣ Voltar ao menu`;

export const ASK_GUARDIAN_NAME_TEXT = "Qual o seu nome completo (responsável)?";
export const ASK_GUARDIAN_CPF_TEXT = "Qual o seu CPF (responsável)? Só números.";
export const INVALID_CPF_TEXT = "Esse CPF não parece válido. Pode digitar de novo (só números)?";
export const CPF_TOO_MANY_ERRORS_TEXT =
  "Não consegui validar o CPF. Vou chamar alguém da equipe para te ajudar.\n\n9️⃣ Falar com uma pessoa";

export const ASK_CHILD_NAME_TEXT = "Qual o nome completo da criança?";
export const ASK_CHILD_CPF_TEXT =
  "Qual o CPF da criança? Se ela ainda não tem CPF, digite *não tenho*.";
export const ASK_CHILD_BIRTH_TEXT = "Qual a data de nascimento da criança? (formato DD/MM/AAAA)";
export const INVALID_BIRTH_TEXT =
  "Não consegui entender essa data. Envie no formato DD/MM/AAAA, por exemplo 15/03/2019.";

export function askInsuranceText(insurerNames: string[]): string {
  const options = insurerNames.map((n, i) => `${i + 1}️⃣ ${n}`).join("\n");
  const particularIndex = insurerNames.length + 1;
  const otherIndex = insurerNames.length + 2;
  return `Qual o plano/convênio da criança?\n${options}\n${particularIndex}️⃣ Particular (sem convênio)\n${otherIndex}️⃣ Outro convênio`;
}

export const ASK_CARD_NUMBER_TEXT =
  "Qual o número da carteirinha do convênio? Se não souber agora, digite *não sei*.";

export const ASK_HAS_DOCS_TEXT = `A criança já tem o *laudo médico* e a *guia/autorização* do convênio para a avaliação?
1️⃣ Tenho os dois
2️⃣ Só o laudo
3️⃣ Só a guia
4️⃣ Ainda não tenho`;

export const MISSING_DOCS_TEXT = `Entendo. Para a avaliação pelo convênio precisamos obrigatoriamente do *laudo médico* (pediatra/neuro) e da *guia autorizada* pelo plano.

Peça o laudo ao médico da criança e a autorização ao convênio; quando tiver os dois, é só me chamar aqui de novo.

Quer que alguém da equipe entre em contato? 1️⃣ Sim · 2️⃣ Não, obrigado(a)`;

export const MISSING_DOCS_HUMAN_TEXT =
  "Combinado! Alguém da equipe vai entrar em contato para te ajudar com os documentos. 🙏";
export const MISSING_DOCS_NO_HUMAN_TEXT =
  "Tudo bem! Quando tiver o laudo e a guia, é só chamar por aqui. Até logo! 👋";

export const ASK_LAUDO_PDF_TEXT = "Perfeito! Agora envie o *laudo médico* em PDF, por favor.";
export const ASK_GUIA_PDF_TEXT = "Recebido! ✅ Agora envie a *guia/autorização* do convênio em PDF.";
export const NOT_A_PDF_TEXT =
  "Consegue enviar em PDF? Se só tiver foto, digite *9* que a equipe te ajuda a enviar.";

export const REQUEST_RECEIVED_TEXT = `Recebido! ✅ Nossa supervisora vai conferir os documentos e eu te aviso por aqui com os horários disponíveis.

Isso costuma levar até 1 dia útil.`;

export function slotsOfferText(guardianName: string, childName: string): string {
  return `Boa notícia, ${guardianName}! Documentos aprovados. Escolha um horário para a avaliação de ${childName}:`;
}

export const NO_SLOT_FITS_OPTION = "Nenhum horário serve — falar com a equipe";

export const REOPEN_TEMPLATE_FALLBACK_BODY =
  "Olá! Os documentos foram aprovados pela Clínica Faça Amigos. Responda esta mensagem para ver os horários disponíveis da avaliação.";

export const SLOT_TAKEN_TEXT = "Esse horário acabou de ser reservado 😕. Aqui estão os que ainda estão livres:";

export const SLOT_EXPIRED_TEXT = "Essa lista de horários expirou. Deixa eu buscar horários atualizados…";

export function confirmationText(params: {
  childName: string;
  dateLabel: string;
  timeLabel: string;
  roomName: string;
  supervisorName: string;
  address: string | null;
}): string {
  const { childName, dateLabel, timeLabel, roomName, supervisorName, address } = params;
  return `Confirmado! 🎉 Avaliação de ${childName} em ${dateLabel} às ${timeLabel}, na ${roomName}, com ${supervisorName}.
${address ? `Endereço: ${address}.` : ""}
Chegue 10 min antes com documento e carteirinha. Para reagendar, digite *6* no menu.`;
}

export function rejectionText(guardianName: string, reason: string): string {
  return `Olá ${guardianName}. Nossa equipe analisou os documentos e precisamos de um ajuste: ${reason}

Você pode reenviar por aqui (digite *1*) ou falar com a equipe (*9*).`;
}

export const HANDOFF_TEXT_TEMPLATE = (openingHours: string | null) =>
  `Combinado! Alguém da equipe vai te responder por aqui em horário comercial${openingHours ? ` (${openingHours})` : ""}.`;

export const RATE_LIMITED_TEXT =
  "Recebi muitas mensagens suas em pouco tempo — vou te chamar de novo em alguns minutos. Se for urgente, ligue para a clínica.";

export const BOT_PAUSED_TEXT =
  "Um atendente humano já está cuidando da sua conversa. Digite *0* se quiser voltar ao menu automático.";

export const MANAGE_NO_APPOINTMENT_TEXT =
  "Não encontrei nenhuma sessão futura vinculada ao seu contato. Digite *9* para falar com a equipe.";

export function manageSessionListText(rows: { label: string }[]): string {
  return `Suas próximas sessões:\n${rows.map((r, i) => `${i + 1}️⃣ ${r.label}`).join("\n")}\n\nResponda com o número da sessão.`;
}

export const MANAGE_ACTION_TEXT = "O que deseja fazer com essa sessão?\n1️⃣ Confirmar presença\n2️⃣ Reagendar";
export const SESSION_CONFIRMED_TEXT = "Presença confirmada! ✅ Até lá.";
export const RESCHEDULE_OFFER_INTRO_TEXT = "Escolha um novo horário:";
export const RESCHEDULED_TEXT = "Sessão reagendada com sucesso! ✅";
