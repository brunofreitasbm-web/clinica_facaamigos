import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone } from "@/lib/twilio";

/**
 * Perguntas do pré-preenchimento assíncrono de anamnese (disparado por
 * lib/anamnesis-prefill.ts::dispatchAnamnesisPrefillRequest). Deliberadamente
 * curto e sem perguntas que exijam julgamento clínico — o objetivo é coletar
 * dado bruto para o terapeuta revisar e aprofundar na consulta, não
 * substituir a anamnese oficial (`anamneses`, preenchida pelo profissional
 * em app/supervisao/pacientes/[id]/anamnese).
 */
const QUESTIONS: { key: string; prompt: string }[] = [
  {
    key: "queixa_principal",
    prompt: "Qual é a principal queixa ou motivo que trouxe vocês à avaliação?",
  },
  {
    key: "historico_gestacao_desenvolvimento",
    prompt:
      "Há alguma informação sobre gestação, parto ou desenvolvimento (motor, fala, marcos) que considere importante?",
  },
  {
    key: "diagnosticos_medicamentos",
    prompt: "A criança possui algum diagnóstico médico e/ou faz uso de medicação? Se sim, quais?",
  },
  {
    key: "alergias",
    prompt: "Há alergias alimentares ou a medicamentos que devemos saber?",
  },
  {
    key: "expectativas",
    prompt: "Por fim, o que vocês esperam desse primeiro atendimento?",
  },
];

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Processa um passo da conversa de pré-anamnese, se o telefone estiver numa
 * sessão `pre_anamnesis_*`. Roteado em lib/twilio.ts ANTES do fluxo de
 * agendamento (twilio-anamnesis-bot.ts), já que ambos compartilham
 * `chatbot_sessions` por telefone — só um fluxo ativo por vez.
 */
export async function processPreAnamnesisStep(params: {
  from: string;
  body: string;
}): Promise<{ handled: boolean; replyMessage: string }> {
  const phone = formatE164Phone(params.from.replace("whatsapp:", ""));
  const rawBody = (params.body || "").trim();
  const normBody = normalize(rawBody);

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: session } = await db
    .from("chatbot_sessions")
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();

  if (!session || !session.current_step.startsWith("pre_anamnesis")) {
    return { handled: false, replyMessage: "" };
  }

  const data = (session.collected_data as Record<string, unknown>) || {};
  const requestId = data.prefill_request_id as string | undefined;
  const childName = (data.child_name as string) || "seu(sua) filho(a)";

  if (!requestId) {
    return { handled: false, replyMessage: "" };
  }

  const isDecline = normBody === "pular" || normBody.includes("nao quero") || normBody === "nao" || normBody === "n";

  if (session.current_step === "pre_anamnesis_consent") {
    if (isDecline) {
      await Promise.all([
        db
          .from("anamnesis_prefill_requests")
          .update({ status: "recusado", declined_at: new Date().toISOString() })
          .eq("id", requestId),
        db
          .from("chatbot_sessions")
          .update({ current_step: "idle", collected_data: {}, updated_at: new Date().toISOString() })
          .eq("phone_number", phone),
      ]);

      return {
        handled: true,
        replyMessage:
          "Sem problemas! Vamos preencher tudo com você presencialmente no dia da consulta. Até breve! 👋",
      };
    }

    // Qualquer outra resposta é tratada como consentimento — começa a
    // primeira pergunta.
    await db
      .from("chatbot_sessions")
      .update({
        current_step: "pre_anamnesis_q0",
        collected_data: { ...data, answers: {} },
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage: `Ótimo, obrigado! 🙏\n\n${QUESTIONS[0].prompt}`,
    };
  }

  const questionMatch = session.current_step.match(/^pre_anamnesis_q(\d+)$/);
  if (questionMatch) {
    const index = Number(questionMatch[1]);
    const question = QUESTIONS[index];

    if (!question) {
      return { handled: false, replyMessage: "" };
    }

    if (isDecline) {
      await Promise.all([
        db
          .from("anamnesis_prefill_requests")
          .update({ status: "recusado", declined_at: new Date().toISOString() })
          .eq("id", requestId),
        db
          .from("chatbot_sessions")
          .update({ current_step: "idle", collected_data: {}, updated_at: new Date().toISOString() })
          .eq("phone_number", phone),
      ]);

      return {
        handled: true,
        replyMessage: "Sem problemas! Vamos preencher o restante com você presencialmente. Até breve! 👋",
      };
    }

    if (!rawBody) {
      return { handled: true, replyMessage: `Não recebi sua resposta. ${question.prompt}` };
    }

    const answers = { ...(data.answers as Record<string, string>), [question.key]: rawBody };
    const nextIndex = index + 1;
    const nextQuestion = QUESTIONS[nextIndex];

    if (nextQuestion) {
      await db
        .from("chatbot_sessions")
        .update({
          current_step: `pre_anamnesis_q${nextIndex}`,
          collected_data: { ...data, answers },
          updated_at: new Date().toISOString(),
        })
        .eq("phone_number", phone);

      return { handled: true, replyMessage: nextQuestion.prompt };
    }

    // Última pergunta respondida: grava e encerra o fluxo.
    await Promise.all([
      db
        .from("anamnesis_prefill_requests")
        .update({ status: "respondido", structured: answers, responded_at: new Date().toISOString() })
        .eq("id", requestId),
      db
        .from("chatbot_sessions")
        .update({ current_step: "idle", collected_data: {}, updated_at: new Date().toISOString() })
        .eq("phone_number", phone),
    ]);

    return {
      handled: true,
      replyMessage:
        `Muito obrigado! 🙏 Recebemos as informações sobre *${childName}*.\n\n` +
        "O terapeuta vai revisar tudo com vocês presencialmente na consulta — até breve!",
    };
  }

  return { handled: false, replyMessage: "" };
}
