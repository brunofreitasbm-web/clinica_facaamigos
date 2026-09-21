"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTwilioWhatsApp } from "@/lib/twilio";
import {
  buildMissingDocumentMessage,
  findMissingDocumentTemplate,
  templateKeyFor,
} from "@/lib/document-request-templates";

export type DocumentRequestResult =
  | { success: true; sentAt: string; warning?: string }
  | { success: false; error: string };

/**
 * Cobrança de documento pendente em um clique (cartão do contato na fila de
 * pendências). Manda a mensagem pronta pelo WhatsApp do contato e grava a
 * saída em `messages` com `template_key`, pra cobrança aparecer no histórico
 * da conversa (módulo de Atendimento) e a própria fila conseguir mostrar
 * "já cobrado em …" depois de recarregar.
 *
 * Só envia por uma conversa que já existe: se a família nunca escreveu, não
 * há janela de 24h aberta na Meta e o envio livre seria recusado de
 * qualquer jeito (erro 63016) — nesse caso a recepção precisa usar um
 * template aprovado pelo módulo de Atendimento.
 */
export async function requestMissingDocument(
  draftId: string,
  documentKey: string,
): Promise<DocumentRequestResult> {
  const template = findMissingDocumentTemplate(documentKey);
  if (!template) return { success: false, error: "Documento desconhecido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, source_phone, patient_id, patients(full_name)")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (!draft.source_phone) {
    return { success: false, error: "Este contato não tem telefone de WhatsApp." };
  }

  const { data: conversation } = await supabase
    .from("twilio_conversations")
    .select("id, phone_number, patient_id, guardian_id")
    .eq("phone_number", draft.source_phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return {
      success: false,
      error: "Nenhuma conversa de WhatsApp aberta com este número — envie pelo módulo de Atendimento.",
    };
  }

  const patient = Array.isArray(draft.patients) ? draft.patients[0] : draft.patients;
  const body = buildMissingDocumentMessage(template, patient?.full_name ?? null);

  const sendResult = await sendTwilioWhatsApp({ to: conversation.phone_number, message: body });

  // Mesma leitura de falha do envio manual (app/recepcao/atendimento/actions.ts):
  // conta sem KYC aprovado não é erro de operação, é ambiente — a mensagem
  // fica registrada e a recepção é avisada de que o envio externo não saiu.
  const isKycOrAccountPending =
    !sendResult.success &&
    Boolean(
      sendResult.error &&
        (sendResult.error.includes("20003") ||
          sendResult.error.includes("compliance profile") ||
          sendResult.error.includes("Trust Hub") ||
          sendResult.error.includes("não está configurado")),
    );

  if (!sendResult.success && !isKycOrAccountPending) {
    return {
      success: false,
      error: sendResult.error || "Falha ao enviar a cobrança pelo WhatsApp.",
    };
  }

  const sentAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("messages").insert({
    patient_id: conversation.patient_id ?? draft.patient_id,
    guardian_id: conversation.guardian_id,
    conversation_id: conversation.id,
    sender_type: "agent",
    channel: "whatsapp",
    direction: "outbound",
    body,
    sent_at: sentAt,
    twilio_sid: sendResult.messageId ?? null,
    delivery_status: sendResult.success ? "sent" : "simulated_dev",
    template_key: templateKeyFor(template.key),
  });

  if (insertError) return { success: false, error: insertError.message };

  // Um humano falou com a família: a conversa sai da fila de escalação do bot.
  await supabase
    .from("twilio_conversations")
    .update({ last_message_at: sentAt, status: "open", escalation_reason: null })
    .eq("id", conversation.id);

  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/recepcao/atendimento");

  return isKycOrAccountPending
    ? {
        success: true,
        sentAt,
        warning:
          "Registrado no histórico, mas o envio externo não saiu (perfil KYC pendente no console da Twilio).",
      }
    : { success: true, sentAt };
}
