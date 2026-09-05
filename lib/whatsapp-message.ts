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
