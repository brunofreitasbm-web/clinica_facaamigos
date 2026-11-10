"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildMessagePreview, findOrCreateConversation } from "@/lib/twilio";
import { getWhatsAppTemplateForCategory, sendWhatsApp } from "@/lib/whatsapp";
import {
  DOCUMENTS_OPENER_KEY,
  buildDocumentsOpenerMessage,
  buildMissingDocumentMessage,
  documentsOpenerChildPhrase,
  findMissingDocumentTemplate,
  templateKeyFor,
  templateKeyForMany,
} from "@/lib/document-request-templates";
import { buildChaseMessage, normalizeChaseKeys } from "@/lib/intake-actions-pure";

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
  return sendDocumentChase(draftId, (patientName) => ({
    body: buildMissingDocumentMessage(template, patientName),
    templateKey: templateKeyFor(template.key),
  }));
}

/**
 * "Cobrar o que falta" da Fila de entrada: UMA mensagem com todos os documentos
 * pendentes (texto em buildChaseMessage, lib/intake-actions-pure.ts), pelo mesmo
 * caminho de envio e registro de requestMissingDocument.
 *
 * Registro: uma linha só em `messages` por envio (a família recebeu uma
 * mensagem, e o histórico da conversa mostra uma), com
 * `template_key = documento_pendente:laudo_medico+pedido_medico`. A leitura em
 * lib/reception-queue.ts (getDraftDocumentRequests, via parseTemplateKeys)
 * desdobra a chave em um "cobrado em …" por documento, então documentRequests
 * e familyChasedAt continuam iguais a se cada documento tivesse sido cobrado
 * à parte, sem duplicar a mensagem no histórico.
 *
 * `patientNameHint` é o nome que a tela mostrou na prévia: usado só quando o
 * contato ainda não tem paciente cadastrado, para o texto enviado ser o mesmo
 * que a recepção conferiu.
 */
export async function requestMissingDocuments(
  draftId: string,
  documentKeys: string[],
  patientNameHint?: string | null,
): Promise<DocumentRequestResult> {
  const keys = normalizeChaseKeys(Array.isArray(documentKeys) ? documentKeys : []);
  if (keys.length === 0) return { success: false, error: "Nenhum documento pendente para cobrar." };
  const hint = typeof patientNameHint === "string" ? patientNameHint.trim().slice(0, 120) || null : null;
  return sendDocumentChase(draftId, (patientName) => ({
    body: buildChaseMessage(keys, patientName ?? hint),
    templateKey: keys.length === 1 ? templateKeyFor(keys[0]) : templateKeyForMany(keys),
  }));
}

/** Envio e registro comuns às cobranças (um documento ou vários). */
async function sendDocumentChase(
  draftId: string,
  build: (patientName: string | null) => { body: string; templateKey: string },
): Promise<DocumentRequestResult> {
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
      error: "Nenhuma conversa de WhatsApp aberta com este número. Envie pelo módulo de Atendimento.",
    };
  }

  const patient = Array.isArray(draft.patients) ? draft.patients[0] : draft.patients;
  const { body, templateKey } = build(patient?.full_name ?? null);

  const sendResult = await sendWhatsApp({ to: conversation.phone_number, message: body });

  // Mesma leitura de falha do envio manual (app/recepcao/atendimento/actions.ts):
  // conta sem KYC aprovado não é erro de operação, é ambiente. A mensagem
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
    template_key: templateKey,
  });

  if (insertError) return { success: false, error: insertError.message };

  // Um humano falou com a família: a conversa sai da fila de escalação do bot.
  await supabase
    .from("twilio_conversations")
    .update({ last_message_at: sentAt, last_message_preview: buildMessagePreview(body), status: "open", escalation_reason: null })
    .eq("id", conversation.id);

  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/recepcao/a-autorizar");
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

/**
 * "Abrir conversa": manda, via modelo aprovado na Meta (Content API), uma
 * mensagem genérica pedindo para a família responder — é o que reabre a janela
 * de 24h quando a cobrança livre de `requestMissingDocument` seria recusada
 * (erro 63016) ou quando o contato nunca escreveu. Depois que a família
 * responde, a recepção conversa/cobra normalmente.
 *
 * Diferente da cobrança, cria a conversa se ainda não existir (lead que veio
 * por outro canal e só tem telefone no rascunho) e NÃO engole falha de envio:
 * sem entrega não há conversa aberta, então registrar "sucesso" enganaria.
 * Envio manual tira o bot da frente, como em sendTemplateMessage.
 */
export async function openDocumentConversation(draftId: string): Promise<DocumentRequestResult> {
  const contentSid = getWhatsAppTemplateForCategory(DOCUMENTS_OPENER_KEY);
  if (!contentSid) {
    return {
      success: false,
      error: "Modelo de abertura não configurado (TWILIO_DOCUMENTS_OPENER_TEMPLATE_CONTENT_SID).",
    };
  }

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

  const patient = Array.isArray(draft.patients) ? draft.patients[0] : draft.patients;
  const patientName = patient?.full_name ?? null;
  const body = buildDocumentsOpenerMessage(patientName);

  let conversation;
  try {
    conversation = await findOrCreateConversation({
      phoneNumber: draft.source_phone,
      patientId: draft.patient_id,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Falha ao abrir a conversa." };
  }

  const sendResult = await sendWhatsApp({
    to: conversation.phone_number,
    message: body,
    contentSid,
    contentVariables: { "1": documentsOpenerChildPhrase(patientName) },
  });

  if (!sendResult.success) {
    return { success: false, error: sendResult.error || "Falha ao enviar o modelo pelo WhatsApp." };
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
    delivery_status: "sent",
    template_key: DOCUMENTS_OPENER_KEY,
  });
  if (insertError) return { success: false, error: insertError.message };

  await supabase
    .from("twilio_conversations")
    .update({
      last_message_at: sentAt,
      last_message_preview: buildMessagePreview(body),
      status: "open",
      escalation_reason: null,
      is_bot_active: false,
    })
    .eq("id", conversation.id);

  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/atendimento");

  return { success: true, sentAt };
}
