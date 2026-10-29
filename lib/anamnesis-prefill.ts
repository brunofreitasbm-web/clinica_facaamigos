import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, getTwilioContentSidForCategory } from "@/lib/twilio";
import { sendWhatsApp } from "@/lib/whatsapp";
import { CLINIC_TIMEZONE } from "@/lib/constants";

/**
 * Dispara o convite de anamnese assíncrona por WhatsApp assim que a
 * avaliação é agendada (chamado por scheduleEvaluation em
 * app/recepcao/pacientes/[id]/stage-actions.ts). Usa admin client porque
 * `anamnesis_prefill_requests`/`chatbot_sessions` só aceitam escrita fora de
 * sessão de usuário (ver policies na migration) — mesmo padrão dos outros
 * disparos Twilio do projeto.
 *
 * Falha graciosamente (não lança) se não houver responsável com telefone ou
 * se o Twilio não estiver configurado: a avaliação já foi agendada com
 * sucesso, isso é só um reforço — sem ele o terapeuta faz a anamnese
 * presencial normalmente.
 */
export async function dispatchAnamnesisPrefillRequest(params: {
  patientId: string;
  appointmentId: string;
  startsAt: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { patientId, appointmentId, startsAt } = params;

  try {
    const admin = createAdminClient();

    const [{ data: patient }, { data: guardians }] = await Promise.all([
      admin.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
      admin.from("guardians").select("id, full_name, phone, is_financial").eq("patient_id", patientId),
    ]);

    const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
    if (!guardian?.phone) return { sent: false, reason: "Responsável sem telefone." };

    const phone = formatE164Phone(guardian.phone);
    if (!phone) return { sent: false, reason: "Telefone do responsável inválido." };

    const childName = patient?.full_name ?? "seu(sua) filho(a)";
    const formattedDate = new Date(startsAt).toLocaleString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;

    const { data: request, error: requestError } = await db
      .from("anamnesis_prefill_requests")
      .insert({
        patient_id: patientId,
        appointment_id: appointmentId,
        guardian_id: guardian.id,
        phone_number: phone,
      })
      .select("id")
      .single();

    if (requestError || !request) {
      // 23505 = já existe pedido pra este appointment (unique index) — não é erro real.
      if (requestError && requestError.code !== "23505") {
        console.error("[Anamnesis Prefill] Falha ao criar solicitação:", requestError.message);
      }
      return { sent: false, reason: requestError?.code === "23505" ? "Convite já criado para este agendamento." : "Falha ao registrar o convite." };
    }

    const consentMessage = buildConsentMessage(childName, formattedDate);
    // Template (convite_pre_anamnese) quando configurado: texto livre só é entregue com a
    // janela de 24h aberta, e a confirmação do horário pode ter sido horas depois da escolha.
    const contentSid = getTwilioContentSidForCategory("convite_pre_anamnese");
    const guardianFirstName = (guardian.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    const sendResult = await sendWhatsApp({
      to: phone,
      message: consentMessage,
      ...(contentSid ? { contentSid, contentVariables: { "1": guardianFirstName || "família", "2": childName, "3": formattedDate } } : {}),
    });

    if (!sendResult.success) {
      console.error("[Anamnesis Prefill] Falha ao enviar WhatsApp:", sendResult.error);
      // Sem entrega, o pedido não pode ficar como "enviado": as telas mostrariam um convite
      // que a família nunca recebeu. Removido, o convite pode ser disparado de novo.
      await db.from("anamnesis_prefill_requests").delete().eq("id", request.id);
      return { sent: false, reason: sendResult.error ?? "Falha ao enviar o convite por WhatsApp." };
    }

    await db.from("chatbot_sessions").upsert(
      {
        phone_number: phone,
        current_step: "pre_anamnesis_consent",
        collected_data: { prefill_request_id: request.id, child_name: childName },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone_number" },
    );
    return { sent: true };
  } catch (err) {
    console.error("[Anamnesis Prefill] Exceção ao disparar convite:", err);
    return { sent: false, reason: "Erro inesperado ao disparar o convite." };
  }
}

/**
 * Mensagem de consentimento explícito antes de qualquer coleta — deixa claro
 * que quem responde é um assistente automatizado, qual a finalidade dos
 * dados, e que a família pode recusar e preencher tudo presencialmente sem
 * prejuízo no atendimento (ver conversa sobre ética/CFP e LGPD).
 */
export function buildConsentMessage(childName: string, formattedDate: string): string {
  return (
    "Olá! 👋 Aqui é o assistente virtual da clínica.\n\n" +
    `A avaliação de *${childName}* foi agendada para ${formattedDate}. Para o terapeuta chegar mais preparado, gostaríamos de coletar algumas informações antes da consulta — leva poucos minutos.\n\n` +
    "Essas respostas serão revisadas e aprofundadas pelo terapeuta durante o atendimento; elas não substituem a anamnese clínica presencial.\n\n" +
    "Você concorda em responder por aqui? Responda *SIM* para começar ou *PULAR* se preferir preencher tudo presencialmente com o terapeuta.\n\n" +
    "FaçaAmigos - Centro de Terapia Comportamental"
  );
}

export function buildReminderMessage(childName: string): string {
  return (
    `Olá! 👋 Notamos que ainda não conseguimos preencher juntos a anamnese de *${childName}* antes da consulta.\n\n` +
    "Se puder, responda *SIM* agora para começarmos — leva poucos minutos e ajuda o terapeuta a chegar mais preparado.\n\n" +
    "Se preferir, sem problemas: responda *PULAR* e preenchemos tudo presencialmente no dia da consulta."
  );
}
