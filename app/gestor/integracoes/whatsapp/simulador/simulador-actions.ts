// app/gestor/integracoes/whatsapp/simulador/simulador-actions.ts
"use server";

/**
 * Simulador do chatbot pra testar o fluxo inteiro sem depender do Twilio —
 * decisão do dono da clínica: a conta Twilio hoje é trial, sem WhatsApp
 * Sender aprovado, e o sandbox pode estar bloqueado pro Brasil (ver
 * lib/whatsapp/env.ts, WHATSAPP_TRANSPORT). Chama `ingestInboundMessage`
 * direto — sem passar pela validação de assinatura do webhook real, porque
 * aqui "quem está mandando a mensagem" é você mesmo testando, não o Twilio.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ingestInboundMessage } from "@/lib/whatsapp/ingest";
import { sanitizeFileName } from "@/lib/document-categories";
import { SIMULATOR_WA_ID } from "./constants";

const SIGNED_URL_TTL_SECONDS = 900;

type ActionResult = { success: true } | { success: false; error: string };

export async function sendSimulatedMessage(formData: FormData): Promise<ActionResult> {
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");

  let mediaUrl0: string | undefined;
  let mediaContentType0: string | undefined;
  let numMedia = 0;

  if (file instanceof File && file.size > 0) {
    const admin = createAdminClient();
    const path = `simulator/${randomUUID()}/${sanitizeFileName(file.name)}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("clinic-documents")
      .upload(path, arrayBuffer, { contentType: file.type || "application/pdf", upsert: false });
    if (uploadError) {
      return { success: false, error: "Não foi possível simular o envio do arquivo." };
    }
    const { data: signed } = await admin.storage.from("clinic-documents").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signed) {
      mediaUrl0 = signed.signedUrl;
      mediaContentType0 = file.type || "application/pdf";
      numMedia = 1;
    }
  }

  if (!text && numMedia === 0) {
    return { success: false, error: "Escreva uma mensagem ou anexe um PDF." };
  }

  try {
    await ingestInboundMessage({
      waId: SIMULATOR_WA_ID,
      profileName: "Responsável (simulado)",
      body: text,
      numMedia,
      mediaUrl0,
      mediaContentType0,
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao processar mensagem." };
  }

  revalidatePath("/gestor/integracoes/whatsapp/simulador");
  return { success: true };
}

export type TranscriptRow = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  createdAt: string;
};

export async function getTranscript(): Promise<TranscriptRow[]> {
  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("whatsapp_conversations")
    .select("id")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("wa_id", SIMULATOR_WA_ID)
    .maybeSingle();

  if (!conversation) return [];

  const { data } = await admin
    .from("whatsapp_messages")
    .select("id, direction, body, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    direction: m.direction as "inbound" | "outbound",
    body: m.body,
    createdAt: m.created_at,
  }));
}

/** Zera a conversa de teste pra recomeçar o fluxo do zero (soft reset — não apaga o transcript). */
export async function resetSimulatorConversation(): Promise<ActionResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_conversations")
    .update({
      state: "menu",
      context: {},
      patient_id: null,
      guardian_id: null,
      consent_at: null,
      human_requested_at: null,
    })
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("wa_id", SIMULATOR_WA_ID);

  if (error) return { success: false, error: "Não foi possível reiniciar a conversa." };
  revalidatePath("/gestor/integracoes/whatsapp/simulador");
  return { success: true };
}

/**
 * Simula a janela de 24h do WhatsApp expirando — pra testar o caminho de
 * template aprovado (ver lib/whatsapp/notify.ts) sem esperar 24h de verdade.
 */
export async function expireSimulatorWindow(): Promise<ActionResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_conversations")
    .update({ window_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("wa_id", SIMULATOR_WA_ID);

  if (error) return { success: false, error: "Não foi possível simular a expiração da janela." };
  revalidatePath("/gestor/integracoes/whatsapp/simulador");
  return { success: true };
}
