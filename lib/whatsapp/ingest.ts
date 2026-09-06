// lib/whatsapp/ingest.ts
/**
 * Passo comum entre o webhook real do Twilio e o simulador
 * (app/gestor/integracoes/whatsapp/simulador): resolve a conversa (upsert
 * por clinic_id+wa_id), grava a mensagem inbound com idempotência por
 * `provider_sid` e só então decide, chamando `handleInbound`. Mantido fora
 * de bot.ts pra este arquivo poder ser chamado de dois lugares sem duplicar
 * a lógica de upsert/idempotência.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { handleInbound, type NormalizedInbound } from "./bot";

export type RawInboundMessage = {
  waId: string; // já normalizado (E.164 sem "+")
  profileName?: string;
  body: string;
  numMedia: number;
  mediaUrl0?: string;
  mediaContentType0?: string;
  listId?: string;
  buttonPayload?: string;
  providerSid?: string; // MessageSid do Twilio — undefined no simulador
};

/** Retorna `false` se a mensagem já tinha sido processada (retry do Twilio). */
export async function ingestInboundMessage(raw: RawInboundMessage): Promise<boolean> {
  const admin = createAdminClient();

  const { data: conversation, error: convError } = await admin
    .from("whatsapp_conversations")
    .upsert(
      { clinic_id: DEV_CLINIC_ID, wa_id: raw.waId, profile_name: raw.profileName ?? null, last_inbound_at: new Date().toISOString(), window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      { onConflict: "clinic_id,wa_id" },
    )
    .select("id")
    .single();

  if (convError || !conversation) {
    throw new Error(`Não foi possível resolver a conversa: ${convError?.message}`);
  }

  if (raw.providerSid) {
    const { error: insertError } = await admin.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      provider_sid: raw.providerSid,
      body: raw.body,
      media_count: raw.numMedia,
    });
    if (insertError) {
      // unique_violation em provider_sid = Twilio reenviando o mesmo webhook.
      if (insertError.code === "23505") return false;
      throw new Error(`Não foi possível registrar a mensagem: ${insertError.message}`);
    }
  } else {
    await admin.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      body: raw.body,
      media_count: raw.numMedia,
    });
  }

  const input: NormalizedInbound = {
    text: raw.body ?? "",
    listId: raw.listId ?? raw.buttonPayload ?? null,
    mediaUrl: raw.numMedia > 0 ? raw.mediaUrl0 ?? null : null,
    mediaContentType: raw.numMedia > 0 ? raw.mediaContentType0 ?? null : null,
  };

  await handleInbound(conversation.id, input);
  return true;
}
