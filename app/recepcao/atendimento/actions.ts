"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTwilioWhatsApp } from "@/lib/twilio";
import { createInteressadoAction, type CreateInteressadoInput } from "../actions";

export async function sendManualMessage(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { success: false as const, error: "Mensagem vazia." };

  const supabase = await createClient();

  const { data: conversation, error: convError } = await supabase
    .from("twilio_conversations")
    .select("id, phone_number, patient_id, guardian_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError || !conversation) {
    return { success: false as const, error: "Conversa não encontrada." };
  }

  const sendResult = await sendTwilioWhatsApp({ to: conversation.phone_number, message: trimmed });

  // Detecta se a falha é por conta/perfil KYC pendente na Twilio ou por bloqueio de janela 24h da Meta (Erro 63016)
  const isKycOrAccountPending =
    !sendResult.success &&
    Boolean(
      sendResult.error &&
        (sendResult.error.includes("20003") ||
          sendResult.error.includes("compliance profile") ||
          sendResult.error.includes("Trust Hub") ||
          sendResult.error.includes("não está configurado")),
    );

  const deliveryStatus = sendResult.success
    ? "sent"
    : isKycOrAccountPending
      ? "simulated_dev"
      : "failed";

  const { error: insertError } = await supabase.from("messages").insert({
    patient_id: conversation.patient_id,
    guardian_id: conversation.guardian_id,
    conversation_id: conversation.id,
    sender_type: "agent",
    channel: "whatsapp",
    direction: "outbound",
    body: trimmed,
    sent_at: new Date().toISOString(),
    twilio_sid: sendResult.messageId ?? null,
    delivery_status: deliveryStatus,
  });

  if (insertError) {
    return { success: false as const, error: insertError.message };
  }

  if (isKycOrAccountPending) {
    await supabase
      .from("twilio_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "open", escalation_reason: null })
      .eq("id", conversationId);

    revalidatePath("/recepcao/atendimento");
    return {
      success: true as const,
      warning:
        "Mensagem registrada no histórico local (O envio externo requer a validação de perfil KYC no Console da Twilio).",
    };
  }

  if (!sendResult.success) {
    return {
      success: false as const,
      error: sendResult.error || "Falha ao enviar mensagem pelo Twilio WhatsApp.",
    };
  }

  // Um humano respondeu: a conversa sai da fila de escalação do bot
  await supabase
    .from("twilio_conversations")
    .update({ last_message_at: new Date().toISOString(), status: "open", escalation_reason: null })
    .eq("id", conversationId);

  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function toggleBotActive(conversationId: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update(
      value
        ? { is_bot_active: true, status: "open", escalation_reason: null }
        : { is_bot_active: false },
    )
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

/**
 * "Assumir" a conversa: registra quem da equipe está cuidando dela (coluna
 * `assigned_to`, que existe desde a migration 20260906000010 mas nunca foi
 * usada) e tira o bot da frente, para ninguém responder em duplicidade.
 */
export async function assignConversation(conversationId: string, assign: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Sessão expirada." };

  const { error } = await supabase
    .from("twilio_conversations")
    .update(assign ? { assigned_to: user.id, is_bot_active: false } : { assigned_to: null })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const, assignedTo: assign ? user.id : null };
}

/**
 * Encerrar devolve a conversa ao bot e libera o responsável; se o contato
 * escrever de novo, o webhook (lib/twilio.ts) reabre sozinho.
 */
export async function setConversationClosed(conversationId: string, closed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update(
      closed
        ? { status: "closed", unread_count: 0, assigned_to: null, is_bot_active: true, escalation_reason: null }
        : { status: "open" },
    )
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function updateConversationContactName(conversationId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update({ contact_name: name.trim() || null })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function saveConversationNote(conversationId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update({ internal_note: note.trim() || null, internal_note_updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

/**
 * Cadastro rápido de interessado a partir de uma conversa de lead. Diferente
 * de cadastrar pela home da recepção, aqui a conversa é vinculada na hora —
 * o webhook só promoveria o lead na PRÓXIMA mensagem que o contato mandasse.
 * As mensagens já trocadas também ganham o patient_id, para aparecerem no
 * histórico do paciente.
 */
export async function registerLeadAsInteressado(conversationId: string, input: CreateInteressadoInput) {
  const result = await createInteressadoAction(input);
  if (!result.success || !result.patientId) {
    return { success: false as const, error: result.error ?? "Falha ao cadastrar interessado." };
  }

  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, full_name")
    .eq("patient_id", result.patientId)
    .limit(1)
    .maybeSingle();

  const { error: linkError } = await supabase
    .from("twilio_conversations")
    .update({
      patient_id: result.patientId,
      guardian_id: guardian?.id ?? null,
      kind: "patient",
      contact_name: input.guardianName.trim() || null,
    })
    .eq("id", conversationId);

  if (linkError) {
    return {
      success: false as const,
      error: `Paciente cadastrado, mas a conversa não foi vinculada: ${linkError.message}`,
    };
  }

  await supabase
    .from("messages")
    .update({ patient_id: result.patientId, guardian_id: guardian?.id ?? null })
    .eq("conversation_id", conversationId)
    .is("patient_id", null);

  revalidatePath("/recepcao/atendimento");
  return {
    success: true as const,
    patientId: result.patientId,
    guardianId: guardian?.id ?? null,
    patientName: input.fullName.trim(),
    guardianName: guardian?.full_name ?? null,
    warning: result.error ?? null,
  };
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function createQuickResponse(clinicId: string, shortcut: string, title: string, contentText: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("quick_responses").insert({
    clinic_id: clinicId,
    shortcut: shortcut.startsWith("/") ? shortcut : `/${shortcut}`,
    title,
    content_text: contentText,
    created_by: user?.id ?? null,
  });

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function updateQuickResponse(id: string, title: string, contentText: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quick_responses")
    .update({ title, content_text: contentText })
    .eq("id", id);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function deleteQuickResponse(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quick_responses").delete().eq("id", id);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}
