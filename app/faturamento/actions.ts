"use server";

import { sendTwilioNotificationAction } from "@/app/actions/twilio";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Cobrança de 1 clique da tela de Fechamento: reusa o mesmo canal Twilio
 * (WhatsApp/SMS) já usado pra família, mas mandando pro terapeuta — sem
 * tabela de notificação própria, é só um disparo pontual.
 */
export async function notifyTherapistAction(params: {
  therapistPhone: string | null;
  therapistName: string;
  patientName: string;
  startsAt: string;
}): Promise<ActionResult> {
  const { therapistPhone, therapistName, patientName, startsAt } = params;

  if (!therapistPhone) {
    return { success: false, error: `${therapistName} não tem telefone cadastrado.` };
  }

  const sessionDate = new Date(startsAt).toLocaleDateString("pt-BR");
  const message = `Olá ${therapistName}! A sessão de ${patientName} em ${sessionDate} está sem evolução assinada e a receita está bloqueada no faturamento. Assine a evolução para liberar a cobrança.`;

  const result = await sendTwilioNotificationAction({
    to: therapistPhone,
    message,
    channel: "whatsapp",
  });

  if (!result.success) {
    return { success: false, error: result.error || "Não foi possível notificar o terapeuta." };
  }

  return { success: true };
}
