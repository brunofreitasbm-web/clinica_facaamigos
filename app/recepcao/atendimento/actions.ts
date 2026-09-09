"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTwilioWhatsApp } from "@/lib/twilio";

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
    delivery_status: sendResult.success ? "sent" : "failed",
  });

  if (insertError) {
    return { success: false as const, error: insertError.message };
  }

  if (!sendResult.success) {
    return {
      success: false as const,
      error: sendResult.error || "Falha ao enviar mensagem pelo Twilio WhatsApp.",
    };
  }

  // Um humano respondeu: a conversa sai da fila de escalação do bot
  // (status 'pending', definido em lib/twilio-faq-bot.ts).
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
