"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Configurações globais do bot (`chatbot_settings`, uma linha por clínica).
 * Lidas com cache em lib/twilio-faq-bot.ts (teto diário) e lib/twilio.ts
 * (chave-geral e saudação de fallback) — ver comentários nesses arquivos.
 */
export async function updateChatbotSettings(formData: FormData): Promise<ActionResult> {
  const botEnabled = formData.get("botEnabled") === "on";
  const dailyReplyLimitRaw = String(formData.get("dailyReplyLimit") ?? "").trim();
  const greetingFallback = String(formData.get("greetingFallback") ?? "").trim();

  const dailyReplyLimit = Number(dailyReplyLimitRaw);
  if (!Number.isInteger(dailyReplyLimit) || dailyReplyLimit < 1) {
    return { success: false, error: "O teto diário de respostas deve ser um número inteiro maior que zero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("chatbot_settings").upsert(
    {
      clinic_id: DEV_CLINIC_ID,
      bot_enabled: botEnabled,
      daily_reply_limit: dailyReplyLimit,
      greeting_fallback: greetingFallback || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "clinic_id" },
  );

  if (error) {
    return { success: false, error: "Não foi possível salvar — verifique se você tem permissão de supervisão/gestão." };
  }

  revalidatePath("/recepcao/atendimento");
  return { success: true };
}
